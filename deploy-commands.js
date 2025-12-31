import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

import leaderboard from './leaderboard.js';

const commands = [
    leaderboard.data.toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log("Deploying commands...");
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log("Commands deployed!");
    } catch (err) {
        console.error(err);
    }
})();
