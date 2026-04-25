import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import express from "express";

console.log("BOOT: starting bot...");

dotenv.config();

console.log("BOOT: env loaded");
console.log("TOKEN exists?", !!process.env.TOKEN);

// 🌐 web server (Render requirement)
const app = express();

app.get("/", (req, res) => {
  res.send("Bot alive");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("WEB: listening on", PORT);
});

// 🤖 bot
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log("BOT: logged in as", client.user.tag);
});

client.login(process.env.TOKEN)
  .then(() => console.log("LOGIN: success"))
  .catch(err => console.error("LOGIN ERROR:", err));
