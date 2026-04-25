const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const {
  getTournament,
  createTournament,
  deleteTournament,
  generateBracket,
  buildBracketEmbed,
  buildMatchButtons,
} = require('../utils/tournamentManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tournament')
    .setDescription('Manage Aethryzx Rivals tournaments')

    // /tournament create
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new tournament')
        .addStringOption(opt =>
          opt.setName('name').setDescription('Tournament name').setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('max_players').setDescription('Max players (2-32)').setMinValue(2).setMaxValue(32))
        .addStringOption(opt =>
          opt.setName('game_mode').setDescription('e.g. 1v1, 2v2').setRequired(false))
    )

    // /tournament join
    .addSubcommand(sub =>
      sub.setName('join')
        .setDescription('Join the active tournament'))

    // /tournament leave
    .addSubcommand(sub =>
      sub.setName('leave')
        .setDescription('Leave the tournament before it starts'))

    // /tournament start
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Lock registrations and start the bracket')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild))

    // /tournament status
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('View current tournament info'))

    // /tournament cancel
    .addSubcommand(sub =>
      sub.setName('cancel')
        .setDescription('Cancel the current tournament')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild))

    // /tournament invite
    .addSubcommand(sub =>
      sub.setName('invite')
        .setDescription('Generate a private server invite link for a match')
        .addUserOption(opt =>
          opt.setName('opponent').setDescription('Your opponent').setRequired(true))),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    // ── CREATE ────────────────────────────────────────────────
    if (sub === 'create') {
      if (getTournament(interaction.guildId)) {
        return interaction.reply({ content: '❌ A tournament is already active. Cancel it first.', ephemeral: true });
      }

      const name = interaction.options.getString('name');
      const maxPlayers = interaction.options.getInteger('max_players') || 16;
      const gameMode = interaction.options.getString('game_mode') || '1v1';

      createTournament(interaction.guildId, {
        name,
        maxPlayers,
        gameMode,
        players: [],
        matches: [],
        currentRound: 0,
        status: 'open',
        channelId: interaction.channelId,
        hostId: interaction.user.id,
      });

      const embed = new EmbedBuilder()
        .setTitle(`🏆 ${name}`)
        .setDescription(`A new tournament has been created!\nUse \`/tournament join\` to register.`)
        .addFields(
          { name: '🎮 Mode', value: gameMode, inline: true },
          { name: '👥 Max Players', value: `${maxPlayers}`, inline: true },
          { name: '📋 Status', value: '🟢 Open', inline: true },
          { name: '🎯 Host', value: `<@${interaction.user.id}>`, inline: true },
        )
        .setColor(0xe63946)
        .setFooter({ text: 'Aethryzx Rivals Clan' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ── JOIN ──────────────────────────────────────────────────
    if (sub === 'join') {
      const t = getTournament(interaction.guildId);
      if (!t) return interaction.reply({ content: '❌ No active tournament.', ephemeral: true });
      if (t.status !== 'open') return interaction.reply({ content: '❌ Registration is closed.', ephemeral: true });
      if (t.players.includes(interaction.user.id)) {
        return interaction.reply({ content: '⚠️ You are already registered!', ephemeral: true });
      }
      if (t.players.length >= t.maxPlayers) {
        return interaction.reply({ content: '❌ Tournament is full.', ephemeral: true });
      }

      t.players.push(interaction.user.id);

      const embed = new EmbedBuilder()
        .setTitle(`✅ Joined: ${t.name}`)
        .setDescription(`<@${interaction.user.id}> has entered the tournament!`)
        .addFields({ name: '👥 Players', value: `${t.players.length} / ${t.maxPlayers}` })
        .setColor(0x2ecc71)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ── LEAVE ─────────────────────────────────────────────────
    if (sub === 'leave') {
      const t = getTournament(interaction.guildId);
      if (!t || t.status !== 'open') return interaction.reply({ content: '❌ Cannot leave right now.', ephemeral: true });
      const idx = t.players.indexOf(interaction.user.id);
      if (idx === -1) return interaction.reply({ content: '⚠️ You are not registered.', ephemeral: true });
      t.players.splice(idx, 1);
      return interaction.reply({ content: `👋 <@${interaction.user.id}> has left the tournament.` });
    }

    // ── STATUS ────────────────────────────────────────────────
    if (sub === 'status') {
      const t = getTournament(interaction.guildId);
      if (!t) return interaction.reply({ content: '❌ No active tournament.', ephemeral: true });

      const playerList = t.players.length
        ? t.players.map((p, i) => `${i + 1}. <@${p}>`).join('\n')
        : '_No players yet_';

      const embed = new EmbedBuilder()
        .setTitle(`📊 ${t.name}`)
        .addFields(
          { name: '🎮 Mode', value: t.gameMode, inline: true },
          { name: '📋 Status', value: t.status === 'open' ? '🟢 Open' : '🔴 In Progress', inline: true },
          { name: '👥 Players', value: `${t.players.length} / ${t.maxPlayers}`, inline: true },
          { name: '🗒️ Roster', value: playerList },
        )
        .setColor(0x3498db)
        .setFooter({ text: 'Aethryzx Rivals Clan' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ── START ─────────────────────────────────────────────────
    if (sub === 'start') {
      const t = getTournament(interaction.guildId);
      if (!t) return interaction.reply({ content: '❌ No active tournament.', ephemeral: true });
      if (t.status !== 'open') return interaction.reply({ content: '⚠️ Tournament already started.', ephemeral: true });
      if (t.players.length < 2) return interaction.reply({ content: '❌ Need at least 2 players.', ephemeral: true });

      t.status = 'active';
      t.currentRound = 1;
      t.matches = generateBracket(t.players);

      const embed = buildBracketEmbed(t, 1);
      await interaction.reply({ content: `🚀 **${t.name}** has started! Good luck everyone!`, embeds: [embed] });

      // Post match buttons
      for (const match of t.matches.filter(m => m.round === 1)) {
        if (!match.player2) {
          match.winner = match.player1;
          await interaction.channel.send(`⚡ <@${match.player1}> advances with a **BYE**`);
          continue;
        }
        const buttons = buildMatchButtons(match);
        await interaction.channel.send({
          content: `🎮 **Match:** <@${match.player1}> vs <@${match.player2}> — report your result below:`,
          components: [buttons],
        });
      }
      return;
    }

    // ── CANCEL ────────────────────────────────────────────────
    if (sub === 'cancel') {
      const t = getTournament(interaction.guildId);
      if (!t) return interaction.reply({ content: '❌ No active tournament.', ephemeral: true });
      deleteTournament(interaction.guildId);
      return interaction.reply({ content: `🗑️ **${t.name}** has been cancelled.` });
    }

    // ── INVITE ────────────────────────────────────────────────
    if (sub === 'invite') {
      const opponent = interaction.options.getUser('opponent');
      const t = getTournament(interaction.guildId);

      // Create a temporary invite to the current channel
      const invite = await interaction.channel.createInvite({
        maxAge: 3600,  // 1 hour
        maxUses: 2,
        reason: `Tournament match invite: ${interaction.user.tag} vs ${opponent.tag}`,
      });

      const embed = new EmbedBuilder()
        .setTitle('🔗 Private Match Invite')
        .setDescription(`<@${interaction.user.id}> has challenged <@${opponent.id}> to a match!`)
        .addFields(
          { name: '🎯 Match', value: `<@${interaction.user.id}> vs <@${opponent.id}>` },
          { name: '🔗 Invite Link', value: `[Click to join](${invite.url}) *(expires in 1 hour, 2 uses)*` },
        )
        .setColor(0x9b59b6)
        .setFooter({ text: 'Aethryzx Rivals Clan' })
        .setTimestamp();

      // DM the opponent
      try {
        await opponent.send({ embeds: [embed] });
        return interaction.reply({ content: `✅ Invite sent to <@${opponent.id}> via DM!`, ephemeral: true });
      } catch {
        return interaction.reply({ embeds: [embed] });
      }
    }
  },
};
