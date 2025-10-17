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
        if (!interaction.guild || !interaction.guildId) { // Added guildId check for safety
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
            // Non-critical: Attempt to DM the user. We wrap this in its own
            // try...catch so a failure here doesn't stop the whole command.
            try {
                await target.send(`You have been muted in **${interaction.guild.name}** for "${durationString}" for the following reason: ${reason}`);
            } catch (dmError) {
                console.warn(`Could not send DM to ${target.user.tag}.`);
            }

            // Defer the reply to let Discord know we're working on it.
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            // Critical Action 1: Mute the member.
            await target.timeout(durationMs, reason);

            // Critical Action 2: Log the action to Firebase.
            const logRef = db.collection('guilds').doc(interaction.guildId).collection('mod-logs');
            await logRef.add({
                action: 'mute',
                targetId: target.id,
                targetTag: target.user.tag,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                duration: durationString,
                reason: reason,
                timestamp: Timestamp.now()
            });

            // If everything above succeeded, edit the deferred reply with the success message.
            await interaction.editReply({ content: `Successfully muted **${target.user.tag}** for ${durationString}. Reason: ${reason}` });

        } catch (error) {
            console.error('An error occurred during the mute process:', error);

            // If any critical action failed, send a follow-up error message.
            const errorMessage = { content: 'An unexpected error occurred. The user may have been muted, but the action could not be logged.' };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }
};

export const data = command.data;