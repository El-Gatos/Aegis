// src/commands/moderation/unmute.ts

import { SlashCommandBuilder, PermissionFlagsBits, GuildMember, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Command } from '../../types/command';
import { db } from '../../utils/firebase';
import { Timestamp } from 'firebase-admin/firestore';

// This command allows a moderator to remove a timeout (unmute) from a member.
export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Removes the timeout from a member.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers) // Requires "Moderate Members" permission
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The member to unmute')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('The reason for unmuting the member')),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: [MessageFlags.Ephemeral] });
            return;
        }

        const target = interaction.options.getMember('target') as GuildMember;
        const reason = interaction.options.getString('reason') ?? 'No reason provided';

        // --- Validation Checks ---
        if (!target) {
            await interaction.reply({ content: "That user isn't in this server.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        if (target.id === interaction.user.id) {
            await interaction.reply({ content: "You can't unmute yourself!", flags: [MessageFlags.Ephemeral] });
            return;
        }

        // Check if the member is actually muted
        if (!target.isCommunicationDisabled()) {
            await interaction.reply({ content: 'This member is not muted.', flags: [MessageFlags.Ephemeral] });
            return;
        }

        if (!target.moderatable) {
            await interaction.reply({ content: "I don't have permission to unmute that member. They may have a higher role than me.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        // --- Execution ---
        try {
            await target.timeout(null, reason); // Setting timeout to null removes it
            await interaction.reply({ content: `Successfully unmuted **${target.user.tag}**. Reason: ${reason}`, flags: [MessageFlags.Ephemeral] });

            // --- Firestore Logging ---
            const logRef = db.collection('guilds').doc(interaction.guildId!).collection('mod-logs');
            await logRef.add({
                action: 'unmute',
                targetId: target.id,
                targetTag: target.user.tag,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                reason: reason,
                timestamp: Timestamp.now()
            });

        } catch (error) {
            console.error('Error unmuting member:', error);
            await interaction.reply({ content: 'An unexpected error occurred while trying to unmute the member.', flags: [MessageFlags.Ephemeral] });
        }
    }
};

export const data = command.data;