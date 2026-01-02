import http from "http";
import { Client, GatewayIntentBits, Collection, REST, Routes, Events } from "discord.js";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";

dotenv.config();

// 🌍 1. KEEP-ALIVE SERVER (CRITICAL FIX)
// We bind to '0.0.0.0' to ensure the hosting provider can see the bot is alive.
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end("LegendBot is Online! 🦚");
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌍 Keep-Alive Server running on port ${PORT}`);
});

// 🚨 2. CONFIGURATION: Strict Channel IDs
const STRICT_CHANNEL_IDS = [
    "1455582132218106151",
    "1427325474551500851",
    "1455906399262605457",
    "1428762702414872636",
    "1428762820585062522"
]; 
const WARNING_TIME = 3 * 60 * 1000; // 3 Minutes

// ---- 3. CLIENT SETUP ----
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.commands = new Collection();
const commandsArray = [];
const DB_FILE = "database.json";
const kickTimers = new Map(); 

// Ensure Database Exists
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 2));
}

// ---- 4. DYNAMIC COMMAND LOADER ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandFiles = fs.readdirSync(__dirname).filter(file => 
    file.endsWith('.js') && file !== 'index.js' && file !== 'deploy-commands.js'
);

const loadAndRegister = async () => {
    for (const file of commandFiles) {
        const command = await import(`./${file}`);
        if (command.default && command.default.data) {
            client.commands.set(command.default.data.name, command.default);
            commandsArray.push(command.default.data.toJSON());
            console.log(`✅ Loaded: /${command.default.data.name}`);
        }
    }
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log("🚀 Refreshing commands...");
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commandsArray },
        );
        console.log("✅ Commands Registered!");
    } catch (error) {
        console.error("❌ Registration Error:", error);
    }
};
await loadAndRegister();

// ---- 5. VOICE TRACKING & KICK LOGIC ----
const isCamOn = (state) => state.selfVideo || state.streaming;

const getDb = () => {
    try { return JSON.parse(fs.readFileSync(DB_FILE)); } catch { return {}; }
};

const saveSession = (userId, durationMinutes, wasCamOn) => {
    if (durationMinutes <= 0) return;
    let db = getDb();
    
    if (!db[userId]) db[userId] = { 
        voice_cam_on_minutes: 0, 
        voice_cam_off_minutes: 0, 
        last_video: false, 
        yesterday: { cam_on: 0, cam_off: 0 } 
    };
    
    // Safety Checks
    if (typeof db[userId].voice_cam_on_minutes !== 'number') db[userId].voice_cam_on_minutes = 0;
    if (typeof db[userId].voice_cam_off_minutes !== 'number') db[userId].voice_cam_off_minutes = 0;

    if (wasCamOn) {
        db[userId].voice_cam_on_minutes += durationMinutes;
        db[userId].last_video = true;
    } else {
        db[userId].voice_cam_off_minutes += durationMinutes;
        db[userId].last_video = false;
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    console.log(`💾 Saved ${durationMinutes}m for ${userId} (Cam: ${wasCamOn})`);
};

// 🛑 KICK LOGIC
const handleKickLogic = (member, state) => {
    const isStrictChannel = STRICT_CHANNEL_IDS.includes(state.channelId);

    if (!isStrictChannel) {
        if (kickTimers.has(member.id)) {
            clearTimeout(kickTimers.get(member.id));
            kickTimers.delete(member.id);
        }
        return;
    }

    if (isCamOn(state)) {
        if (kickTimers.has(member.id)) {
            console.log(`🛡️ ${member.user.tag} turned cam ON. Kick cancelled.`);
            clearTimeout(kickTimers.get(member.id));
            kickTimers.delete(member.id);
        }
    } else {
        if (!kickTimers.has(member.id)) {
            console.log(`⏳ ${member.user.tag} has 3 mins to turn cam on...`);
            const timer = setTimeout(async () => {
                const currentMember = await member.guild.members.fetch(member.id).catch(() => null);
                if (currentMember && 
                    STRICT_CHANNEL_IDS.includes(currentMember.voice.channelId) && 
                    !isCamOn(currentMember.voice)) {
                    try {
                        await currentMember.voice.disconnect("Camera Enforcement");
                        console.log(`🥾 Kicked ${member.user.tag} for no camera.`);
                    } catch (e) { console.error(`Failed to kick:`, e); }
                }
                kickTimers.delete(member.id);
            }, WARNING_TIME);
            kickTimers.set(member.id, timer);
        }
    }
};

client.on("voiceStateUpdate", (oldState, newState) => {
    const member = newState.member || oldState.member;
    if (!member) return;

    const oldCam = isCamOn(oldState);
    const newCam = isCamOn(newState);
    const wasIn = !!oldState.channelId;
    const isIn = !!newState.channelId;

    if (isIn) handleKickLogic(member, newState);
    else if (!isIn && kickTimers.has(member.id)) {
        clearTimeout(kickTimers.get(member.id));
        kickTimers.delete(member.id);
    }

    // Tracking
    if (wasIn && !isIn) { // Left
        if (member.joinTime) {
            saveSession(member.id, Math.floor((Date.now() - member.joinTime) / 60000), oldCam);
        }
        member.joinTime = null;
    } else if (!wasIn && isIn) { // Joined
        member.joinTime = Date.now();
    } else if (wasIn && isIn && oldCam !== newCam) { // Switched
        if (member.joinTime) {
            saveSession(member.id, Math.floor((Date.now() - member.joinTime) / 60000), oldCam);
        }
        member.joinTime = Date.now();
    }
});

// ---- 6. AUTO-SAVER ----
setInterval(() => {
    const voiceChannels = client.channels.cache.filter(c => c.type === 2);
    voiceChannels.forEach(channel => {
        channel.members.forEach(member => {
            if (member.joinTime) {
                const mins = Math.floor((Date.now() - member.joinTime) / 60000);
                if (mins > 0) {
                    saveSession(member.id, mins, isCamOn(member.voice));
                    member.joinTime = Date.now(); 
                }
            }
        });
    });
}, 2 * 60 * 1000);

// ---- 7. INTERACTION HANDLER ----
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const cmd = client.commands.get(interaction.commandName);
    if (cmd) try { await cmd.execute(interaction); } catch (e) { console.error(e); }
});

// ---- 8. READY & MIDNIGHT RESET ----
client.once(Events.ClientReady, (c) => {
    console.log(`✅ Logged in as ${c.user.tag}`);
    cron.schedule('0 0 * * *', () => {
        console.log("🕛 Midnight Reset!");
        let db = getDb();
        for (const id in db) {
            db[id].yesterday = { cam_on: db[id].voice_cam_on_minutes || 0, cam_off: db[id].voice_cam_off_minutes || 0 };
            db[id].voice_cam_on_minutes = 0;
            db[id].voice_cam_off_minutes = 0;
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    }, { timezone: "Asia/Kolkata" });
});

client.login(process.env.DISCORD_TOKEN);