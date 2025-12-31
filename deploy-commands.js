import { REST, Routes } from "discord.js";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const commands = [];
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Find all .js command files (skipping system files)
const commandFiles = fs.readdirSync(__dirname).filter(file => 
    file.endsWith('.js') && file !== 'index.js' && file !== 'deploy-commands.js'
);

console.log(`Found ${commandFiles.length} command files.`);

// 2. Load them dynamically
for (const file of commandFiles) {
    const command = await import(`./${file}`);
    if (command.default && command.default.data) {
        commands.push(command.default.data.toJSON());
        console.log(`➕ Queued: /${command.default.data.name}`);
    }
}

// 3. Register with Discord
// Note: We check both names in case you named it TOKEN or DISCORD_TOKEN
const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`🚀 Refreshing ${commands.length} application (/) commands...`);

        // Register Global Commands (Works on all servers)
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID), 
            { body: commands },
        );

        console.log(`✅ Successfully reloaded ${commands.length} commands!`);
    } catch (error) {
        console.error("❌ Deploy Error:", error);
    }
})();