import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export default {
    data: new SlashCommandBuilder()
        .setName("ask")
        .setDescription("Ask AI a study doubt (Debug Version)")
        .addStringOption(option => 
            option.setName("question")
                .setDescription("What is your doubt?")
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const question = interaction.options.getString("question");
        const apiKey = process.env.AI_API_KEY;

        // CHECK 1: Is the key loaded?
        if (!apiKey) {
            return interaction.editReply("❌ **Error:** The `AI_API_KEY` variable is missing. Did you redeploy?");
        }

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Answer this NEET question in simple English: ${question}`
                        }]
                    }]
                })
            });

            const data = await response.json();

            // CHECK 2: Did Google send an error?
            if (data.error) {
                console.log("Google API Error:", data.error);
                return interaction.editReply(`❌ **Google API Error:**\n${data.error.message}`);
            }

            // CHECK 3: valid answer?
            let answer = "No answer found.";
            if (data.candidates && data.candidates[0].content) {
                answer = data.candidates[0].content.parts[0].text;
            } else {
                return interaction.editReply("❌ **Error:** AI connected but returned no content. (Likely safety filter blocked it)");
            }

            const embed = new EmbedBuilder()
                .setColor(0x00BFFF)
                .setTitle(`🤖 AI Doubt Solution`)
                .setDescription(`**Q:** ${question}\n\n**A:** ${answer}`)
                .setFooter({ text: "Powered by Gemini AI" });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ **Network Error:** ${error.message}`);
        }
    }
};