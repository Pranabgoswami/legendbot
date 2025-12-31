LegendBot — Study Bot (voice tracking + leaderboard)

1) Install dependencies
   npm install

2) Create .env with:
   DISCORD_TOKEN=...
   CLIENT_ID=...
   GUILD_ID=...   # optional (for testing use guild; for global remove or blank)

3) Deploy slash commands (for testing in a guild, include GUILD_ID)
   npm run deploy

4) Start the bot
   npm start

Notes:
- The bot stores daily stats in database.json.
- Daily stats reset at local midnight (server time).
- To persist voice minutes across restarts while someone is in voice, avoid restarting the bot mid-session; the code tracks last_join timestamps but if bot restarts while user is in voice, last_join will be null until they rejoin. You can extend to fetch voice channel members on startup to set last_join if needed.
- Add AI API by setting AI_API_KEY and customizing the fetch call in index.js (the code contains a placeholder).
