// src/commands/moderation/ban.ts

import { SlashCommandBuilder, PermissionFlagsBits, GuildMember, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Command } from '../../types/command';
import { db } from '../../utils/firebase';
import { CollectionReference, Timestamp } from 'firebase-admin/firestore';

// This command allows a moderator to ban a member from the server.
export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Select a member and ban them from the server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers) // Requires "Ban Members" permission
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The member to ban')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('The reason for banning the member'))
        .addIntegerOption(option =>
            option
                .setName('delete_messages')
                .setDescription('How much of their recent message history to delete.')
                .addChoices(
                    { name: 'Don\'t delete any', value: 0 },
                    { name: 'Previous 24 hours', value: 1 },
                    { name: 'Previous 7 days', value: 7 }
                )),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            return;
        }

        const target = interaction.options.getMember('target') as GuildMember;
        const reason = interaction.options.getString('reason') ?? 'No reason provided';
        const deleteMessageDays = interaction.options.getInteger('delete_messages') ?? 0;

        // --- Validation Checks ---
        if (!target) {
            await interaction.reply({ content: "That user isn't in this server.", flags: MessageFlags.Ephemeral });
            return;
        }

        if (target.id === interaction.user.id) {
            await interaction.reply({ content: "You can't ban yourself!", flags: MessageFlags.Ephemeral });
            return;
        }

        if (target.id === interaction.client.user.id) {
            await interaction.reply({ content: "You can't ban me!", flags: MessageFlags.Ephemeral });
            return;
        }

        if (target.roles.highest.position >= (interaction.member as GuildMember).roles.highest.position) {
            await interaction.reply({ content: "You can't ban a member with an equal or higher role than you.", flags: MessageFlags.Ephemeral });
            return;
        }

        if (!target.bannable) {
            await interaction.reply({ content: "I don't have permission to ban that member. They may have a higher role than me.", flags: MessageFlags.Ephemeral });
            return;
        }

        // --- Execution ---
        try {
            await target.send(`You have been banned from **${interaction.guild.name}** for the following reason: ${reason}`);
        } catch (error) {
            console.warn(`Could not send DM to ${target.user.tag}. They may have DMs disabled.`);
        }

        try {
            // Convert days to seconds for the new option
            const deleteMessageSeconds = deleteMessageDays * 24 * 60 * 60;

            await target.ban({
                deleteMessageSeconds: deleteMessageSeconds, // Use the new option
                reason: reason
            });
            await interaction.reply({ content: `Successfully banned **${target.user.tag}** for: ${reason}` });
            const logRef = db.collection('guilds').doc(interaction.guildId!).collection('mod-logs');
            await logRef.add({
                action: 'ban',
                targetId: target.id,
                targetTag: target.user.tag,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                reason: reason,
                timestamp: Timestamp.now()
            });
        } catch (error) {
            console.error('Error banning member:', error);
            await interaction.reply({ content: 'An unexpected error occurred while trying to ban the member.', flags: MessageFlags.Ephemeral });
        }
    }
};

export const data = command.data;