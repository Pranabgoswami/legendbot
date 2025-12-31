import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export default {
    data: new SlashCommandBuilder()
        .setName("summary")
        .setDescription("Get a short NCERT summary topic"),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle("📖 NCERT Summary: Photosynthesis")
            .setColor(0x2E8B57)
            .setDescription("**Photosynthesis** is the process used by plants to convert light energy into chemical energy.\n\n**Equation:**\n`6CO2 + 12H2O → C6H12O6 + 6H2O + 6O2`\n\n**Key Sites:**\n- **Chloroplasts:** Site of photosynthesis.\n- **Thylakoids:** Light reaction occurs here.\n- **Stroma:** Dark reaction (Calvin cycle) occurs here.")
            .setFooter({ text: "Read your NCERT for full details!" });

        await interaction.reply({ embeds: [embed] });
    }
};