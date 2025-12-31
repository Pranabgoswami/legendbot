import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

const questions = [
    { subject: "Biology", q: "Which organelle is known as the 'powerhouse' of the cell?", a: "Mitochondria" },
    { subject: "Physics", q: "What is the unit of capacitance?", a: "Farad" },
    { subject: "Chemistry", q: "What is the general formula for Alkanes?", a: "CnH2n+2" },
    { subject: "Biology", q: "What is the functional unit of the kidney?", a: "Nephron" }
];

export default {
    data: new SlashCommandBuilder()
        .setName("qod")
        .setDescription("Get Question of the Day (Bio/Chem/Phys)"),

    async execute(interaction) {
        const item = questions[Math.floor(Math.random() * questions.length)];
        
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(`❓ Question of the Day: ${item.subject}`)
            .setDescription(`**${item.q}**\n\n||Answer: ${item.a}||`) // Answer is hidden as spoiler
            .setFooter({ text: "Click the black box to reveal the answer!" });

        await interaction.reply({ embeds: [embed] });
    }
};