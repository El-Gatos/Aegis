// src/commands/admin/settings.ts

import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, MessageFlags, ChannelType, TextChannel, EmbedBuilder } from 'discord.js';
import { Command } from '../../types/command';
import { db } from '../../utils/firebase';
import { FieldValue } from 'firebase-admin/firestore';

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Configure bot settings for this server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('log-channel')
                .setDescription('Set the channel where moderation actions are logged.')
                .addChannelOption(option =>
                    option.setName('channel').setDescription('The text channel to send logs to').addChannelTypes(ChannelType.GuildText).setRequired(true)
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName('blacklist')
                .setDescription('Manage the automod banned words list.')
                .addSubcommand(subcommand =>
                    subcommand.setName('add').setDescription('Add a word to the blacklist.').addStringOption(option => option.setName('word').setDescription('The word to blacklist').setRequired(true))
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('remove').setDescription('Remove a word from the blacklist.').addStringOption(option => option.setName('word').setDescription('The word to remove').setRequired(true))
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('list').setDescription('Lists all words in the blacklist.')
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName('warn-escalation')
                .setDescription('Manage automatic actions for receiving warnings.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('add')
                        .setDescription('Add a new warning escalation rule.')
                        .addIntegerOption(option => option.setName('warnings').setDescription('Number of warnings to trigger the action.').setRequired(true).setMinValue(1))
                        .addStringOption(option =>
                            option.setName('action').setDescription('The action to take.').setRequired(true).addChoices({ name: 'Mute', value: 'mute' }, { name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' })
                        )
                        .addStringOption(option => option.setName('duration').setDescription('Mute duration (e.g., 10m, 1h, 7d) - only for Mute action.'))
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('remove').setDescription('Remove a warning escalation rule.').addIntegerOption(option => option.setName('warnings').setDescription('The warning count of the rule to remove.').setRequired(true))
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('list').setDescription('Lists all warning escalation rules.')
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;

        const group = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();
        const guildDocRef = db.collection('guilds').doc(interaction.guildId);

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            if (group === 'blacklist') {
                // ... blacklist logic will go here
            } else if (group === 'warn-escalation') {
                // ... warn escalation logic will go here
            } else {
                // Handle top-level subcommands like log-channel
                if (subcommand === 'log-channel') {
                    const channel = interaction.options.getChannel('channel', true) as TextChannel;
                    await guildDocRef.set({ settings: { logChannelId: channel.id } }, { merge: true });
                    await interaction.editReply(`✅ Moderation log channel has been set to **#${channel.name}**.`);
                }
            }

            // For simplicity, let's add the detailed logic for the new groups now
            if (group === 'blacklist') {
                const word = interaction.options.getString('word')?.toLowerCase();
                if (subcommand === 'add' && word) {
                    await guildDocRef.set({ automod: { bannedWords: FieldValue.arrayUnion(word) } }, { merge: true });
                    await interaction.editReply(`✅ The word \`${word}\` has been added to the blacklist.`);
                } else if (subcommand === 'remove' && word) {
                    await guildDocRef.update({ 'automod.bannedWords': FieldValue.arrayRemove(word) });
                    await interaction.editReply(`✅ The word \`${word}\` has been removed from the blacklist.`);
                } else if (subcommand === 'list') {
                    const doc = await guildDocRef.get();
                    const words = doc.data()?.automod?.bannedWords || [];
                    if (words.length === 0) {
                        await interaction.editReply('The blacklist is currently empty.');
                        return;
                    }
                    const listEmbed = new EmbedBuilder().setColor('Blue').setTitle('Banned Words List').setDescription(words.map((w: string) => `\`${w}\``).join(', '));
                    await interaction.editReply({ embeds: [listEmbed] });
                }
            }

            if (group === 'warn-escalation') {
                const warnings = interaction.options.getInteger('warnings');
                if (subcommand === 'add') {
                    const action = interaction.options.getString('action', true);
                    const duration = interaction.options.getString('duration');
                    const rule = { action, duration: action === 'mute' ? duration : null };

                    await guildDocRef.set({ automod: { escalationRules: { [warnings!]: rule } } }, { merge: true });
                    await interaction.editReply(`✅ Rule created: At **${warnings}** warnings, the user will be **${action}ed**.`);
                } else if (subcommand === 'remove') {
                    await guildDocRef.update({ [`automod.escalationRules.${warnings}`]: FieldValue.delete() });
                    await interaction.editReply(`✅ Escalation rule for **${warnings}** warnings has been removed.`);
                } else if (subcommand === 'list') {
                    const doc = await guildDocRef.get();
                    const rules = doc.data()?.automod?.escalationRules || {};
                    const sortedRules = Object.entries(rules).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

                    if (sortedRules.length === 0) {
                        await interaction.editReply('No warning escalation rules have been set.');
                        return;
                    }

                    const description = sortedRules.map(([count, rule]: [string, any]) => {
                        let ruleDesc = `**${count} Warnings:** \`${rule.action}\``;
                        if (rule.action === 'mute' && rule.duration) {
                            ruleDesc += ` for \`${rule.duration}\``;
                        }
                        return ruleDesc;
                    }).join('\n');

                    const listEmbed = new EmbedBuilder().setColor('Blue').setTitle('Warning Escalation Rules').setDescription(description);
                    await interaction.editReply({ embeds: [listEmbed] });
                }
            }

        } catch (error) {
            console.error("Error in settings command:", error);
            await interaction.editReply({ content: "An error occurred. Please ensure the settings path exists by adding a rule or word first." });
        }
    }
};

export const data = command.data;