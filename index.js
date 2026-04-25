const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { REST, Routes } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();

const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
const commandsData = [];

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
  commandsData.push(command.data.toJSON());
}

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
      { body: commandsData }
    );
    console.log('✅ Slash commands registered');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(err);
      const msg = { content: '❌ An error occurred.', ephemeral: true };
      interaction.replied ? interaction.followUp(msg) : interaction.reply(msg);
    }
  }
  if (interaction.isButton()) {
    const { handleButton } = require('./utils/tournamentManager');
    await handleButton(interaction, client);
  }
});

client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log('✅ Login successful'))
  .catch(err => console.error('❌ Login failed:', err.message));

const http = require('http');
http.createServer((req, res) => res.end('alive')).listen(10000);
