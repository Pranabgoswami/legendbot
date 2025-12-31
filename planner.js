import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export default {
    data: new SlashCommandBuilder()
        .setName("planner")
        .setDescription("Generate a standard NEET study plan"),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle("📅 Daily NEET Study Plan")
            .addFields(
                { name: "🌅 Morning (6:00 AM - 1:00 PM)", value: "• **6-7 AM:** Wake up & Freshen up\n• **8:45 AM - 1:00 PM:** Live Class / Lectures" },
                { name: "☀️ Afternoon (1:00 PM - 5:00 PM)", value: "• **1-2 PM:** Bath + Lunch\n• **2-3:30 PM:** Live Class / Self Study\n• **3:30-4:30 PM:** Revision (Current day class)" },
                { name: "🌇 Evening (5:00 PM - 9:00 PM)", value: "• **5-6 PM:** Ionic Equilibrium / Physical Chem Practice\n• **6-8 PM:** NLM / Physics Practice" },
                { name: "🌙 Night (9:00 PM - 12:00 AM)", value: "• **9-10 PM:** Biology (Plant Kingdom/Circulatory)\n• **10-10:30 PM:** Dinner\n• **10:30-12:00 AM:** GOC / Organic Chem" }
            )
            .setFooter({ text: "Consistency is key! Adjust times as needed." });

        await interaction.reply({ embeds: [embed] });
    }
};