import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export default {
    data: new SlashCommandBuilder()
        .setName("ask")
        .setDescription("Ask AI a study doubt (Biology/Physics/Chemistry)")
        .addStringOption(option => 
            option.setName("question")
                .setDescription("What is your doubt?")
                .setRequired(true)),

    async execute(interaction) {
        // 1. Defer Reply (AI takes a few seconds to think)
        await interaction.deferReply();

        const question = interaction.options.getString("question");
        const apiKey = process.env.AI_API_KEY;

        if (!apiKey) {
            return interaction.editReply("❌ AI API Key is missing from dashboard variables!");
        }

        try {
            // 2. Prepare the request for Gemini API
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `You are a helpful NEET exam tutor for Indian students. 
                            Answer this question clearly and concisely in simple English (mixed with Hinglish if helpful). 
                            Keep it short (under 200 words) and focus on NCERT concepts.
                            
                            Question: ${question}`
                        }]
                    }]
                })
            });

            const data = await response.json();

            // 3. Extract the answer
            let answer = "Could not generate an answer.";
            if (data.candidates && data.candidates[0].content) {
                answer = data.candidates[0].content.parts[0].text;
            }

            // 4. Send the result
            const embed = new EmbedBuilder()
                .setColor(0x00BFFF) // Deep Sky Blue
                .setTitle(`🤖 AI Doubt Solution`)
                .setDescription(`**Q:** ${question}\n\n**A:** ${answer}`)
                .setFooter({ text: "Powered by Gemini AI • Verify with NCERT" });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply("❌ Failed to contact AI. Try again later.");
        }
    }
};