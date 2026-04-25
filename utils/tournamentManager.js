const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// In-memory store (use a DB for persistence)
const tournaments = new Map();

function getTournament(guildId) {
  return tournaments.get(guildId) || null;
}

function createTournament(guildId, data) {
  tournaments.set(guildId, data);
}

function deleteTournament(guildId) {
  tournaments.delete(guildId);
}

// Generate single-elimination bracket
function generateBracket(players) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const matches = [];
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    matches.push({
      id: `match_${Date.now()}_${i}`,
      player1: shuffled[i],
      player2: shuffled[i + 1] || null, // BYE if odd number
      winner: null,
      round: 1,
    });
  }
  return matches;
}

// Build bracket embed
function buildBracketEmbed(tournament, round) {
  const matches = tournament.matches.filter(m => m.round === round);
  const embed = new EmbedBuilder()
    .setTitle(`⚔️ ${tournament.name} — Round ${round}`)
    .setColor(0xe63946)
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/1067/1067357.png')
    .setFooter({ text: 'Aethryzx Rivals Clan • Tournament Bracket' })
    .setTimestamp();

  matches.forEach((match, i) => {
    const p2 = match.player2 ? `<@${match.player2}>` : '**BYE**';
    const status = match.winner
      ? `✅ Winner: <@${match.winner}>`
      : '🔴 Pending';
    embed.addFields({
      name: `Match ${i + 1}`,
      value: `<@${match.player1}> **vs** ${p2}\n${status}`,
      inline: false,
    });
  });

  return embed;
}

// Report match result buttons
function buildMatchButtons(match) {
  if (!match.player2) return null; // BYE — auto advance
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`win_${match.id}_${match.player1}`)
      .setLabel('P1 Won')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`win_${match.id}_${match.player2}`)
      .setLabel('P2 Won')
      .setStyle(ButtonStyle.Danger)
  );
  return row;
}

// Advance to next round or declare winner
async function advanceRound(interaction, client) {
  const tournament = getTournament(interaction.guildId);
  if (!tournament) return;

  const currentMatches = tournament.matches.filter(m => m.round === tournament.currentRound);
  const allDone = currentMatches.every(m => m.winner !== null);
  if (!allDone) return;

  const winners = currentMatches.map(m => m.winner);

  if (winners.length === 1) {
    // Tournament over
    const champion = winners[0];
    const embed = new EmbedBuilder()
      .setTitle('🏆 TOURNAMENT OVER!')
      .setDescription(`# 👑 <@${champion}> is the Champion!\nCongratulations to the winner of **${tournament.name}**!`)
      .setColor(0xffd700)
      .setTimestamp()
      .setFooter({ text: 'Aethryzx Rivals Clan' });

    const channel = await client.channels.fetch(tournament.channelId);
    await channel.send({ embeds: [embed] });

    // Give champion role if configured
    if (process.env.CHAMPION_ROLE_ID) {
      const guild = await client.guilds.fetch(interaction.guildId);
      const member = await guild.members.fetch(champion);
      await member.roles.add(process.env.CHAMPION_ROLE_ID).catch(() => {});
    }

    deleteTournament(interaction.guildId);
    return;
  }

  // Build next round
  tournament.currentRound += 1;
  const nextRound = tournament.currentRound;
  for (let i = 0; i < winners.length - 1; i += 2) {
    tournament.matches.push({
      id: `match_${Date.now()}_r${nextRound}_${i}`,
      player1: winners[i],
      player2: winners[i + 1] || null,
      winner: null,
      round: nextRound,
    });
  }

  const channel = await client.channels.fetch(tournament.channelId);
  const embed = buildBracketEmbed(tournament, nextRound);
  await channel.send({ embeds: [embed] });

  // Post match buttons
  const roundMatches = tournament.matches.filter(m => m.round === nextRound);
  for (const match of roundMatches) {
    if (!match.player2) {
      match.winner = match.player1; // BYE auto-win
      await channel.send(`⚡ <@${match.player1}> advances with a **BYE**`);
      continue;
    }
    const buttons = buildMatchButtons(match);
    await channel.send({
      content: `🎮 **Match:** <@${match.player1}> vs <@${match.player2}>`,
      components: [buttons],
    });
  }

  // Check if all BYEs resolved this round too
  await advanceRound(interaction, client);
}

// Handle button clicks
async function handleButton(interaction, client) {
  const [action, matchId, winnerId] = interaction.customId.split('_').reduce((acc, val, i, arr) => {
    if (i === 0) acc.push(val);
    else if (i <= 2) acc.push(val);
    else acc[acc.length - 1] += '_' + val;
    return acc;
  }, []);

  // Simpler parse
  const parts = interaction.customId.split('_');
  const act = parts[0]; // "win"
  const wId = parts[parts.length - 1]; // last part is winner id
  const mId = parts.slice(1, -1).join('_'); // middle is match id

  if (act !== 'win') return;

  const tournament = getTournament(interaction.guildId);
  if (!tournament) return await interaction.reply({ content: 'No active tournament.', ephemeral: true });

  // Only admins or the players can report
  const match = tournament.matches.find(m => m.id === mId);
  if (!match) return await interaction.reply({ content: 'Match not found.', ephemeral: true });

  const isPlayer = [match.player1, match.player2].includes(interaction.user.id);
  const isAdmin = interaction.member.permissions.has('ManageGuild');
  if (!isPlayer && !isAdmin) {
    return interaction.reply({ content: '❌ Only players or admins can report results.', ephemeral: true });
  }

  match.winner = wId;
  await interaction.update({ content: `✅ <@${wId}> wins this match!`, components: [] });

  await advanceRound(interaction, client);
}

module.exports = {
  getTournament,
  createTournament,
  deleteTournament,
  generateBracket,
  buildBracketEmbed,
  buildMatchButtons,
  handleButton,
};
