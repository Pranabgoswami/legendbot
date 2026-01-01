import { Client, GatewayIntentBits, Collection, REST, Routes } from "discord.js";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.commands = new Collection();
const commandsArray = [];
const DB_FILE = "database.json";

// Ensure Database Exists with Valid JSON
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 2));
}

// ---- 1. DYNAMIC COMMAND LOADER & REGISTRATION ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commandFiles = fs.readdirSync(__dirname).filter(file => 
    file.endsWith('.js') && file !== 'index.js' && file !== 'deploy-commands.js'
);

const loadAndRegister = async () => {
    // 1. Load Commands
    for (const file of commandFiles) {
        const command = await import(`./${file}`);
        if (command.default && command.default.data) {
            client.commands.set(command.default.data.name, command.default);
            commandsArray.push(command.default.data.toJSON());
            console.log(`✅ Loaded: /${command.default.data.name}`);
        }
    }

    // 2. Register Commands Instantly
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log("🚀 Refreshing commands...");
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commandsArray },
        );
        console.log("✅ Commands Registered!");
    } catch (error) {
        console.error("❌ Registration Error (Check GUILD_ID in dashboard):", error);
    }
};

await loadAndRegister();

// ---- 2. ADVANCED VOICE TRACKING (The Fix) ----

// Helper: Check if Cam is On (Video OR Screen Share)
const isCamOn = (state) => state.selfVideo || state.streaming;

// Helper: Load DB safely
const getDb = () => {
    try {
        return JSON.parse(fs.readFileSync(DB_FILE));
    } catch {
        return {};
    }
};

// Helper: Save time segment
const saveSession = (userId, durationMinutes, wasCamOn) => {
    if (durationMinutes <= 0) return;
    
    let db = getDb();
    
    // Initialize user if missing
    if (!db[userId]) {
        db[userId] = { 
            voice_cam_on_minutes: 0, 
            voice_cam_off_minutes: 0, 
            last_video: false,
            yesterday: { cam_on: 0, cam_off: 0 } 
        };
    }
    
    // Safety check for null values
    if (!db[userId].voice_cam_on_minutes) db[userId].voice_cam_on_minutes = 0;
    if (!db[userId].voice_cam_off_minutes) db[userId].voice_cam_off_minutes = 0;

    // SAVE DATA (1 Minute = 1 Minute)
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

client.on("voiceStateUpdate", (oldState, newState) => {
    const member = newState.member || oldState.member;
    if (!member) return;

    const oldCam = isCamOn(oldState);
    const newCam = isCamOn(newState);
    
    const wasIn = !!oldState.channelId;
    const isIn = !!newState.channelId;

    // SCENARIO A: User Left
    if (wasIn && !isIn) {
        if (member.joinTime) {
            const mins = Math.floor((Date.now() - member.joinTime) / 60000);
            saveSession(member.id, mins, oldCam);
        }
        member.joinTime = null;
    }

    // SCENARIO B: User Joined
    else if (!wasIn && isIn) {
        member.joinTime = Date.now();
    }

    // SCENARIO C: User Switched Cam/Stream/Mute (While still in channel)
    else if (wasIn && isIn) {
        // If Cam status changed, SAVE the old session and START a new one
        if (oldCam !== newCam) {
            if (member.joinTime) {
                const mins = Math.floor((Date.now() - member.joinTime) / 60000);
                saveSession(member.id, mins, oldCam); // Save PREVIOUS state
            }
            member.joinTime = Date.now(); // Reset timer for NEW state
        }
        // If they just muted/unmuted but Cam didn't change, we do nothing (timer keeps running)
    }
});

// ---- 3. AUTO-SAVER (Crash Protection) ----
// Saves everyone's current progress every 2 minutes
setInterval(() => {
    const db = getDb();
    const voiceChannels = client.channels.cache.filter(c => c.type === 2); // 2 = Voice Channel

    voiceChannels.forEach(channel => {
        channel.members.forEach(member => {
            if (member.joinTime) {
                const mins = Math.floor((Date.now() - member.joinTime) / 60000);
                if (mins > 0) {
                    // Save and Reset Timer (so we don't double count)
                    saveSession(member.id, mins, isCamOn(member.voice));
                    member.joinTime = Date.now(); 
                }
            }
        });
    });
}, 2 * 60 * 1000); // Run every 2 minutes


// ---- 4. INTERACTION HANDLER ----
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const cmd = client.commands.get(interaction.commandName);
    if (cmd) {
        try { await cmd.execute(interaction); } 
        catch (e) { console.error(e); }
    }
});

// ---- 5. MIDNIGHT RESET (Today -> Yesterday) ----
client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    cron.schedule('0 0 * * *', () => {
        console.log("🕛 Midnight Reset!");
        let db = getDb();
        
        for (const id in db) {
            // Move Today -> Yesterday
            db[id].yesterday = {
                cam_on: db[id].voice_cam_on_minutes || 0,
                cam_off: db[id].voice_cam_off_minutes || 0
            };
            // Reset Today
            db[id].voice_cam_on_minutes = 0;
            db[id].voice_cam_off_minutes = 0;
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    }, { timezone: "Asia/Kolkata" });
});

client.login(process.env.DISCORD_TOKEN);