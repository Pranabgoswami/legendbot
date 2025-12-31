import { Client, GatewayIntentBits, Collection } from "discord.js";
import * as dotenv from "dotenv";
import fs from "fs";
import leaderboard from "./leaderboard.js";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.commands = new Collection();
client.commands.set(leaderboard.data.name, leaderboard);

const DB_FILE = "database.json";
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 2));

// ---- VOICE + CAM TRACKING ----
client.on("voiceStateUpdate", (oldState, newState) => {
  const member = newState.member;
  if (!member) return;

  // JOIN
  if (!oldState.channelId && newState.channelId) {
    member.joinTime = Date.now();
    member.camOn = newState.selfVideo === true;
  }

  // UPDATE CAM STATUS
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
      db[id] = {
        voice_cam_on_minutes: 0,
        voice_cam_off_minutes: 0,
        messages: 0,
        last_join: null,
        last_video: false
      };
    }

    if (member.camOn) {
      db[id].voice_cam_on_minutes += Math.floor(minutes * 1.2); // 🔥 multiplier
      db[id].last_video = true;
    } else {
      db[id].voice_cam_off_minutes += minutes;
      db[id].last_video = false;
    }

    db[id].last_join = Date.now();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

    member.joinTime = null;
    member.camOn = false;
  }
});

// ---- SLASH COMMAND HANDLER ----
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  try {
    await cmd.execute(interaction);
  } catch (e) {
    console.error(e);
    interaction.reply("❌ Command error");
  }
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN);
