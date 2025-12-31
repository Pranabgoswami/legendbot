import { SlashCommandBuilder } from "discord.js";
import fs from "fs";

export default {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Study leaderboard")
    .addStringOption(opt =>
      opt.setName("mode")
        .setDescription("camon | camoff | total")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const mode = interaction.options.getString("mode");
    let db = JSON.parse(fs.readFileSync("database.json"));

    let scores = [];

    for (const id in db) {
      let val = 0;
      if (mode === "camon") val = db[id].voice_cam_on_minutes || 0;
      else if (mode === "camoff") val = db[id].voice_cam_off_minutes || 0;
      else val = (db[id].voice_cam_on_minutes || 0) + (db[id].voice_cam_off_minutes || 0);

      scores.push([id, val]);
    }

    scores = scores.sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (scores.length === 0) return interaction.editReply("No data yet.");

    let title =
      mode === "camon" ? "📷 CAM ON Leaderboard (1.2×)" :
      mode === "camoff" ? "🚫 CAM OFF Leaderboard" :
      "🏆 TOTAL Study Leaderboard";

    let msg = `**${title}**\n\n`;
    let rank = 1;

    for (const [id, min] of scores) {
      const h = Math.floor(min / 60);
      const m = min % 60;
      msg += `**${rank}. <@${id}> — ${h}h ${m}m**\n`;
      rank++;
    }

    interaction.editReply(msg);
  }
};
