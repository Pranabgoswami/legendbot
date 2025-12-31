import { Client, GatewayIntentBits, Collection } from "discord.js";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.commands = new Collection();

// ---- 1. DYNAMIC COMMAND LOADER (The Fix) ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find all files that end with .js (skipping index.js and database.json)
const commandFiles = fs.readdirSync(__dirname).filter(file => 
    file.endsWith('.js') && file !== 'index.js' && file !== 'deploy-commands.js'
);

console.log("--------------------------------");
console.log("Loading commands...");

// We use an async function to load files
const loadCommands = async () => {
    for (const file of commandFiles) {
        try {
            // Import the file dynamically
            const command = await import(`./${file}`);
            
            // Check if it has 'data' and 'execute' (standard discord.js structure)
            if (command.default && command.default.data && command.default.execute) {
                client.commands.set(command.default.data.name, command.default);
                console.log(`✅ Loaded: /${command.default.data.name}`);
            } else {
                console.log(`⚠️ Skipped: ${file} (Invalid command structure)`);
            }
        } catch (error) {
            console.error(`❌ Error loading ${file}:`, error);
        }
    }
    console.log("--------------------------------");
};

// Call the loader
await loadCommands();


// ---- 2. VOICE TRACKING (Keep your existing logic) ----
const DB_FILE = "database.json";
// Ensure DB exists
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 2));

client.on("voiceStateUpdate", (oldState, newState) => {
  const member = newState.member;
  if (!member) return;

  // JOIN
  if (!oldState.channelId && newState.channelId) {
    member.joinTime = Date.now();
    member.camOn = newState.selfVideo === true;
  }
  
  // UPDATE CAM
  if (newState.channelId) {
    member.camOn = newState.selfVideo === true;
  }

  // LEAVE
  if (oldState.channelId && !newState.channelId) {
    if (!member.joinTime) return;
    const minutes = Math.floor((Date.now() - member.joinTime) / 60000);
    if (minutes <= 0) return;

    let db = JSON.parse(fs.readFileSync(DB_FILE));
    const id = member.id;

    if (!db[id]) {
      db[id] = { voice_cam_on_minutes: 0, voice_cam_off_minutes: 0, last_video: false };
    }

    if (member.camOn) {
      db[id].voice_cam_on_minutes += Math.floor(minutes * 1.2); 
      db[id].last_video = true;
    } else {
      db[id].voice_cam_off_minutes += minutes;
      db[id].last_video = false;
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    member.joinTime = null;
    member.camOn = false;
  }
});


// ---- 3. SLASH COMMAND HANDLER ----
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  
  const cmd = client.commands.get(interaction.commandName);
  
  if (!cmd) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
  }

  try {
    await cmd.execute(interaction);
  } catch (e) {
    console.error(e);
    // Avoid crashing if already replied
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ Error executing command!', ephemeral: true });
    } else {
        await interaction.reply({ content: '❌ Error executing command!', ephemeral: true });
    }
  }
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);