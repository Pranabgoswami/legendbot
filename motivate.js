import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

const quotes = [
    "“You don’t have to be great to start, but you have to start to be great.”",
    "“Success is the sum of small efforts, repeated day in and day out.”",
    "“Don’t stop until you’re proud.”",
    "“The pain you feel today will be the strength you feel tomorrow.”",
    "“Your future is created by what you do today, not tomorrow.”",
    "“NEET is not just an exam, it's a battle for your dream white coat.”"
];

export default {
    data: new SlashCommandBuilder()
        .setName("motivate")
        .setDescription("Get a short study motivation message"),

    async execute(interaction) {
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle("🔥 Study Motivation")
            .setDescription(`**${randomQuote}**`)
            .setFooter({ text: "Keep grinding!" });

        await interaction.reply({ embeds: [embed] });
    }
};