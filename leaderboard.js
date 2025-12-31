import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import fs from "fs";

export default {
    data: new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("Shows separate leaderboards for Cam On and Cam Off"),

    async execute(interaction) {
        // 1. Defer reply to prevent "The application did not respond" error
        await interaction.deferReply();

        const DB_FILE = "database.json";
        if (!fs.existsSync(DB_FILE)) {
            return interaction.editReply("❌ No database found yet.");
        }

        const db = JSON.parse(fs.readFileSync(DB_FILE));
        
        // 2. Prepare arrays for both lists
        let camOnUsers = [];
        let camOffUsers = [];

        for (const userId in db) {
            const user = db[userId];
            
            // Add to Cam On list if they have time
            if (user.voice_cam_on_minutes > 0) {
                camOnUsers.push({ id: userId, time: user.voice_cam_on_minutes });
            }

            // Add to Cam Off list if they have time
            if (user.voice_cam_off_minutes > 0) {
                camOffUsers.push({ id: userId, time: user.voice_cam_off_minutes });
            }
        }

        // 3. Sort both lists (highest time first)
        camOnUsers.sort((a, b) => b.time - a.time);
        camOffUsers.sort((a, b) => b.time - a.time);

        // 4. Helper function to make the text list
        function generateList(users) {
            if (users.length === 0) return "No data yet.";
            
            // Take top 10 only
            return users.slice(0, 10).map((u, i) => {
                const hours = Math.floor(u.time / 60);
                const minutes = u.time % 60;
                // Format: #1 <@user> - 2h 30m
                return `**#${i + 1}** <@${u.id}> — ${hours}h ${minutes}m`;
            }).join("\n");
        }

        // 5. Create the Embed with two fields
        const embed = new EmbedBuilder()
            .setTitle(`🏆 Daily Leaderboard`) // You can add date here if you want
            .setColor(0xFFD700) // Gold color
            .addFields(
                { 
                    name: "Cam On ✅", 
                    value: generateList(camOnUsers), 
                    inline: false 
                },
                { 
                    name: "Cam Off ❌", 
                    value: generateList(camOffUsers), 
                    inline: false 
                }
            )
            .setTimestamp();

        // 6. Send it
        await interaction.editReply({ embeds: [embed] });
    }
};