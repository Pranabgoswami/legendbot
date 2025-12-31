import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import fs from "fs";

export default {
    data: new SlashCommandBuilder()
        .setName("mystatus")
        .setDescription("Show your personal study stats"),

    async execute(interaction) {
        const DB_FILE = "database.json";
        if (!fs.existsSync(DB_FILE)) {
            return interaction.reply("❌ No database found yet.");
        }

        const db = JSON.parse(fs.readFileSync(DB_FILE));
        const user = db[interaction.user.id];

        if (!user) {
            return interaction.reply("📉 You haven't started studying yet! Join a voice channel.");
        }

        const camOn = user.voice_cam_on_minutes || 0;
        const camOff = user.voice_cam_off_minutes || 0;
        const total = camOn + camOff;

        const embed = new EmbedBuilder()
            .setColor(0x9932CC)
            .setTitle(`📊 Stats for ${interaction.user.username}`)
            .addFields(
                { name: "Total Study Time", value: `${Math.floor(total / 60)}h ${total % 60}m`, inline: true },
                { name: "📸 Cam On", value: `${Math.floor(camOn / 60)}h ${camOn % 60}m`, inline: true },
                { name: "🎙️ Cam Off", value: `${Math.floor(camOff / 60)}h ${camOff % 60}m`, inline: true }
            );

        await interaction.reply({ embeds: [embed] });
    }
};