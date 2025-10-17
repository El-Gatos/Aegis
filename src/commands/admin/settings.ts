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
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('log-channel')
                .setDescription('Set the channel where moderation actions are logged.')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The text channel to send logs to')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add-word')
                .setDescription('Add a word to the automod blacklist.')
                .addStringOption(option =>
                    option
                        .setName('word')
                        .setDescription('The word to blacklist (case-insensitive)')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove-word')
                .setDescription('Remove a word from the automod blacklist.')
                .addStringOption(option =>
                    option
                        .setName('word')
                        .setDescription('The word to remove from the blacklist')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list-words')
                .setDescription('Lists all words in the automod blacklist.')
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;

        const subcommand = interaction.options.getSubcommand();
        const guildDocRef = db.collection('guilds').doc(interaction.guildId);

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            switch (subcommand) {
                case 'log-channel': {
                    const channel = interaction.options.getChannel('channel', true) as TextChannel;
                    await guildDocRef.set({ settings: { logChannelId: channel.id } }, { merge: true });
                    await interaction.editReply(`✅ Moderation log channel has been set to **#${channel.name}**.`);
                    break;
                }
                case 'add-word': {
                    const word = interaction.options.getString('word', true).toLowerCase();
                    await guildDocRef.update({ 'automod.bannedWords': FieldValue.arrayUnion(word) });
                    await interaction.editReply(`✅ The word \`${word}\` has been added to the blacklist.`);
                    break;
                }
                case 'remove-word': {
                    const word = interaction.options.getString('word', true).toLowerCase();
                    await guildDocRef.update({ 'automod.bannedWords': FieldValue.arrayRemove(word) });
                    await interaction.editReply(`✅ The word \`${word}\` has been removed from the blacklist.`);
                    break;
                }
                case 'list-words': {
                    const doc = await guildDocRef.get();
                    const words = doc.data()?.automod?.bannedWords || [];

                    if (words.length === 0) {
                        await interaction.editReply('The blacklist is currently empty.');
                        return;
                    }

                    const listEmbed = new EmbedBuilder()
                        .setColor('Blue')
                        .setTitle('Banned Words List')
                        .setDescription(words.map((w: string) => `\`${w}\``).join(', '))
                        .setTimestamp();

                    await interaction.editReply({ embeds: [listEmbed] });
                    break;
                }
            }
        } catch (error) {
            console.error("Error in settings command:", error);
            await interaction.editReply({ content: "An error occurred. It's possible this setting doesn't exist yet. Try adding a word first." });
        }
    }
};

export const data = command.data;