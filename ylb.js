import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import fs from "fs";

export default {
    data: new SlashCommandBuilder()
        .setName("ylb")
        .setDescription("View Yesterday's Leaderboard"),
    async execute(interaction) {
        await interaction.deferReply(); 

        const DB_FILE = "database.json";
        let db = {};
        try {
            if (fs.existsSync(DB_FILE)) {
                db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
            }
        } catch (e) {
            return interaction.editReply("❌ Error reading database.");
        }

        const activeUsers = [];

        // 🔍 Filter: Only keep users currently in the server
        for (const [id, data] of Object.entries(db)) {
            // Skip if no data for yesterday
            if (!data.yesterday || (data.yesterday.cam_on === 0 && data.yesterday.cam_off === 0)) continue;

            try {
                const member = await interaction.guild.members.fetch(id);
                if (member) {
                    activeUsers.push({
                        name: member.displayName,
                        camOn: data.yesterday.cam_on || 0,
                        camOff: data.yesterday.cam_off || 0
                    });
                }
            } catch (e) { /* User Left/Kicked - Skip */ }
        }

        // Sort Top 15
        const sortedOn = [...activeUsers].sort((a, b) => b.camOn - a.camOn).slice(0, 15);
        const sortedOff = [...activeUsers].sort((a, b) => b.camOff - a.camOff).slice(0, 10);

        const formatTime = (mins) => {
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            return `${h}h ${m}m`;
        };

        // Build "Cam On" List
        let desc = "**Yesterday's Cam On ✅**\n";
        if (sortedOn.length === 0) desc += "No data for yesterday.\n";
        
        for (const [i, u] of sortedOn.entries()) {
            if (u.camOn > 0) desc += `#${i + 1} **${u.name}** — ${formatTime(u.camOn)}\n`;
        }

        // Build "Cam Off" List
        desc += "\n**Yesterday's Cam Off ❌**\n";
        for (const [i, u] of sortedOff.entries()) {
            if (u.camOff > 0) desc += `#${i + 1} **${u.name}** — ${formatTime(u.camOff)}\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle("⏮️ Yesterday's Leaderboard")
            .setDescription(desc)
            .setColor(0xA9A9A9) // Grey color for "Past"
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};