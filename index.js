import http from "http";
import { Client, GatewayIntentBits, Collection, REST, Routes, Events, EmbedBuilder } from "discord.js";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";

dotenv.config();

// 🌍 1. KEEP-ALIVE SERVER
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end("LegendBot is Online! 🦚");
});
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌍 Keep-Alive Server running on port ${PORT}`);
});

// 🚨 2. CONFIGURATION (Strict Mode Removed)
const AUTO_LB_CHANNEL_ID = "1455385042044846242"; 

// ---- 3. CLIENT SETUP ----
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();
const commandsArray = [];
const DB_FILE = "database.json";
// Removed kickTimers map

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

// ---- 5. HELPERS ----
const isCamOn = (state) => state.selfVideo || state.streaming;

const getDb = () => {
    try { return JSON.parse(fs.readFileSync(DB_FILE)); } catch { return {}; }
};

// ⚡ OPTIMIZED SAVE
const updateDbInMemory = (db, userId, durationMinutes, wasCamOn) => {
    if (durationMinutes <= 0) return;
    
    if (!db[userId]) db[userId] = { 
        voice_cam_on_minutes: 0, 
        voice_cam_off_minutes: 0, 
        last_video: false, 
        yesterday: { cam_on: 0, cam_off: 0 } 
    };
    if (typeof db[userId].voice_cam_on_minutes !== 'number') db[userId].voice_cam_on_minutes = 0;
    if (typeof db[userId].voice_cam_off_minutes !== 'number') db[userId].voice_cam_off_minutes = 0;

    if (wasCamOn) {
        db[userId].voice_cam_on_minutes += durationMinutes;
        db[userId].last_video = true;
    } else {
        db[userId].voice_cam_off_minutes += durationMinutes;
        db[userId].last_video = false;
    }
    return db;
};

const saveSession = (userId, durationMinutes, wasCamOn) => {
    let db = getDb();
    updateDbInMemory(db, userId, durationMinutes, wasCamOn);
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    console.log(`💾 Saved ${durationMinutes}m for ${userId} (Cam: ${wasCamOn})`);
};

// (Removed handleKickLogic entirely)

client.on("voiceStateUpdate", (oldState, newState) => {
    const member = newState.member || oldState.member;
    if (!member) return;
    const oldCam = isCamOn(oldState);
    const newCam = isCamOn(newState);
    const wasIn = !!oldState.channelId;
    const isIn = !!newState.channelId;

    // (Removed Kick Logic Checks here)
    
    // Tracking on Leave/Switch (Pure Tracking Only)
    if ((wasIn && !isIn) || (wasIn && isIn && oldCam !== newCam)) {
        if (member.joinTime) {
            saveSession(member.id, Math.floor((Date.now() - member.joinTime) / 60000), oldCam);
        }
        if (isIn) member.joinTime = Date.now();
        else member.joinTime = null;
    } else if (!wasIn && isIn) {
        member.joinTime = Date.now();
    }
});

// ⚡ 6. OPTIMIZED AUTO-SAVER
setInterval(() => {
    const voiceChannels = client.channels.cache.filter(c => c.type === 2);
    let db = getDb(); 
    let changesMade = false;

    voiceChannels.forEach(channel => {
        channel.members.forEach(member => {
            if (member.joinTime) {
                const mins = Math.floor((Date.now() - member.joinTime) / 60000);
                if (mins > 0) {
                    updateDbInMemory(db, member.id, mins, isCamOn(member.voice));
                    member.joinTime = Date.now(); 
                    changesMade = true;
                }
            }
        });
    });

    if (changesMade) {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
        console.log("💾 Batch Save Complete.");
    }
}, 2 * 60 * 1000);

// ---- 7. INTERACTION HANDLER ----
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const cmd = client.commands.get(interaction.commandName);
    if (cmd) try { await cmd.execute(interaction); } catch (e) { console.error(e); }
});

// ---- 8. CRON JOBS & ANTI-CRASH ----
client.once(Events.ClientReady, (c) => {
    console.log(`✅ Logged in as ${c.user.tag}`);

    // 🏆 AUTO LEADERBOARD (11:55 PM IST)
    cron.schedule('55 23 * * *', async () => {
        console.log("📢 Sending Auto-Leaderboard...");
        const channel = await client.channels.fetch(AUTO_LB_CHANNEL_ID).catch(() => null);
        if (!channel) return console.error("❌ Auto-LB Channel not found!");

        let db = getDb();
        const activeUsers = [];
        const guild = channel.guild;

        for (const [id, data] of Object.entries(db)) {
            try {
                const member = await guild.members.fetch(id); 
                if (member) {
                    activeUsers.push({
                        name: member.displayName,
                        camOn: data.voice_cam_on_minutes || 0,
                        camOff: data.voice_cam_off_minutes || 0
                    });
                }
            } catch (e) { /* Skip Left Users */ }
        }

        const sortedOn = [...activeUsers].sort((a, b) => b.camOn - a.camOn).slice(0, 15);
        const sortedOff = [...activeUsers].sort((a, b) => b.camOff - a.camOff).slice(0, 10);
        const formatTime = (m) => `${Math.floor(m / 60)}h ${m % 60}m`;

        let desc = "**Cam On ✅**\n";
        sortedOn.forEach((u, i) => { if (u.camOn > 0) desc += `#${i+1} **${u.name}** — ${formatTime(u.camOn)}\n`; });
        if(sortedOn.length === 0) desc += "No active study data today.\n";

        desc += "\n**Cam Off ❌**\n";
        sortedOff.forEach((u, i) => { if (u.camOff > 0) desc += `#${i+1} **${u.name}** — ${formatTime(u.camOff)}\n`; });

        const embed = new EmbedBuilder()
            .setTitle("🌙 Daily Final Leaderboard")
            .setDescription(desc)
            .setColor(0x00FF00)
            .setTimestamp()
            .setFooter({ text: "Auto-Generated at 11:55 PM" });

        await channel.send({ embeds: [embed] });

    }, { timezone: "Asia/Kolkata" });

    // 🕛 MIDNIGHT RESET (12:00 AM IST)
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

// 🛡️ ANTI-CRASH
process.on('unhandledRejection', (reason, promise) => {
    console.log('❌ Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
    console.log('❌ Uncaught Exception:', err);
});

client.login(process.env.DISCORD_TOKEN);