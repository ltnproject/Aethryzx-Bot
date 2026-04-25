import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

// 🌐 Keep-alive server (Render needs this)
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// 🤖 Discord bot
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN).catch(err => {
  console.error("Login failed:", err);
});
