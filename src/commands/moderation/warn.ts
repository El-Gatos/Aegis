// src/commands/moderation/warn.ts

import { SlashCommandBuilder, PermissionFlagsBits, GuildMember, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Command } from '../../types/command';
import { db } from '../../utils/firebase';
import { Timestamp } from 'firebase-admin/firestore';

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Issues a formal warning to a member.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The member to warn')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('The reason for the warning')
                .setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: [MessageFlags.Ephemeral] });
            return;
        }

        const target = interaction.options.getMember('target') as GuildMember;
        const reason = interaction.options.getString('reason', true);

        // --- Validation Checks ---
        if (!target) {
            await interaction.reply({ content: "That user isn't in this server.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        // --- Execution ---
        try {
            // Attempt to send a DM to the user
            await target.send(`You have received a warning in **${interaction.guild.name}** for the following reason: ${reason}`);
        } catch (error) {
            console.warn(`Could not send DM to ${target.user.tag}. They may have DMs disabled.`);
        }

        try {
            // Log the warning to Firestore
            const logRef = db.collection('guilds').doc(interaction.guildId!).collection('mod-logs');
            await logRef.add({
                action: 'warn',
                targetId: target.id,
                targetTag: target.user.tag,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                reason: reason,
                timestamp: Timestamp.now()
            });

            // Public confirmation message
            await interaction.reply({ content: `**${target.user.tag}** has been warned for: ${reason}` });

        } catch (error) {
            console.error('Error issuing warning:', error);
            await interaction.reply({ content: 'An unexpected error occurred while trying to issue the warning.' });
        }
    }
};

export const data = command.data;