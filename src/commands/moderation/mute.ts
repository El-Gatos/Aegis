// src/commands/moderation/mute.ts

import { SlashCommandBuilder, PermissionFlagsBits, GuildMember, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Command } from '../../types/command';
import { parseDuration } from '../../utils/durationParser';
import { db } from '../../utils/firebase';
import { CollectionReference, Timestamp } from 'firebase-admin/firestore';

// This command allows a moderator to timeout (mute) a member.
export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Times out a member, preventing them from talking.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers) // Requires "Moderate Members" permission
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The member to mute')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('duration')
                .setDescription('Duration of the mute (e.g., 10m, 1h, 7d)')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('The reason for muting the member')),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: [MessageFlags.Ephemeral] });
            return;
        }

        const target = interaction.options.getMember('target') as GuildMember;
        const durationString = interaction.options.getString('duration', true);
        const reason = interaction.options.getString('reason') ?? 'No reason provided';

        // --- Validation Checks ---
        if (!target) {
            await interaction.reply({ content: "That user isn't in this server.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        if (target.id === interaction.user.id) {
            await interaction.reply({ content: "You can't mute yourself!", flags: [MessageFlags.Ephemeral] });
            return;
        }

        if (target.id === interaction.client.user.id) {
            await interaction.reply({ content: "You can't mute me!", flags: [MessageFlags.Ephemeral] });
            return;
        }

        // Check if the member is already timed out
        if (target.isCommunicationDisabled()) {
            await interaction.reply({ content: 'This member is already muted.', flags: [MessageFlags.Ephemeral] });
            return;
        }

        if (target.roles.highest.position >= (interaction.member as GuildMember).roles.highest.position) {
            await interaction.reply({ content: "You can't mute a member with an equal or higher role than you.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        if (!target.moderatable) {
            await interaction.reply({ content: "I don't have permission to mute that member. They may have a higher role than me.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        // --- Duration Parsing ---
        const durationMs = parseDuration(durationString);
        if (!durationMs) {
            await interaction.reply({
                content: "Invalid duration format. Use `s` for seconds, `m` for minutes, `h` for hours, or `d` for days (e.g., `10m`, `1h`, `7d`).",
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        const MAX_TIMEOUT_DURATION = 28 * 24 * 60 * 60 * 1000; // 28 days in milliseconds
        if (durationMs > MAX_TIMEOUT_DURATION) {
            await interaction.reply({ content: "The timeout duration cannot be longer than 28 days.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        // --- Execution ---
        try {
            await target.send(`You have been muted in **${interaction.guild.name}** for "${durationString}" for the following reason: ${reason}`);
        } catch (error) {
            console.warn(`Could not send DM to ${target.user.tag}.`);
        }

        try {
            await target.timeout(durationMs, reason);
            await interaction.reply({ content: `Successfully muted **${target.user.tag}** for ${durationString}. Reason: ${reason}`, flags: [MessageFlags.Ephemeral] });

            // --- ADD THIS LOGGING LOGIC ---
            const logRef = db.collection('guilds').doc(interaction.guildId!).collection('mod-logs');
            await logRef.add({
                action: 'mute',
                targetId: target.id,
                targetTag: target.user.tag,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                duration: durationString, // Log the human-readable duration
                reason: reason,
                timestamp: Timestamp.now()
            });
            // --- END OF LOGGING LOGIC ---

        } catch (error) {
            console.error('Error muting member:', error);
            await interaction.reply({ content: 'An unexpected error occurred while trying to mute the member.', flags: [MessageFlags.Ephemeral] });
        }
    }
};

export const data = command.data;