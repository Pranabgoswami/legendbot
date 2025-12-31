import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import fs from "fs";

export default {
    data: new SlashCommandBuilder()
        .setName("yst") // <--- This is the new short command name!
        .setDescription("Show my study stats from yesterday"),

    async execute(interaction) {
        const DB_FILE = "database.json";
        if (!fs.existsSync(DB_FILE)) {
            return interaction.reply({ content: "❌ No database found.", ephemeral: true });
        }

        const db = JSON.parse(fs.readFileSync(DB_FILE));
        const user = db[interaction.user.id];

        // Check if "yesterday" data exists
        if (!user || !user.yesterday) {
            return interaction.reply({ content: "📉 No data found for yesterday. (Stats only appear after the midnight reset)", ephemeral: true });
        }

        const camOn = user.yesterday.cam_on || 0;
        const camOff = user.yesterday.cam_off || 0;
        const total = camOn + camOff;

        const embed = new EmbedBuilder()
            .setColor(0x808080) // Grey color indicates "Past"
            .setTitle(`🗓️ Yesterday's Stats: ${interaction.user.username}`)
            .addFields(
                { name: "Total Time", value: `${Math.floor(total / 60)}h ${total % 60}m`, inline: true },
                { name: "📸 Cam On", value: `${Math.floor(camOn / 60)}h ${camOn % 60}m`, inline: true },
                { name: "🎙️ Cam Off", value: `${Math.floor(camOff / 60)}h ${camOff % 60}m`, inline: true }
            )
            .setFooter({ text: "Compare this with today's progress!" });

        await interaction.reply({ embeds: [embed] });
    }
};
