// src/commands/moderation/kick.ts

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember, MessageFlags } from 'discord.js';
import { Command } from '../../types/command';
import { db } from '../../utils/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { sendModLog } from '../../utils/logUtils';

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Select a member and kick them from the server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The member to kick')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('The reason for kicking the member')),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            return;
        }

        const target = interaction.options.getMember('target') as GuildMember;
        const reason = interaction.options.getString('reason') ?? 'No reason provided';

        // --- Validation ---
        if (!target) {
            await interaction.reply({ content: "That user isn't in this server.", flags: MessageFlags.Ephemeral });
            return;
        }
        if (target.id === interaction.user.id) {
            await interaction.reply({ content: "You can't kick yourself!", flags: MessageFlags.Ephemeral });
            return;
        }
        if (target.id === interaction.client.user.id) {
            await interaction.reply({ content: "You can't kick me!", flags: MessageFlags.Ephemeral });
            return;
        }
        if (interaction.member instanceof GuildMember && target.roles.highest.position >= interaction.member.roles.highest.position) {
            await interaction.reply({ content: "You can't kick a member with an equal or higher role than you.", flags: MessageFlags.Ephemeral });
            return;
        }
        if (!target.kickable) {
            await interaction.reply({ content: "I don't have permission to kick that member.", flags: MessageFlags.Ephemeral });
            return;
        }

        // --- Execution ---
        try {
            await target.send(`You have been kicked from **${interaction.guild.name}** for the following reason: ${reason}`);
        } catch (error) {
            console.warn(`Could not send DM to ${target.user.tag}.`);
        }

        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            await target.kick(reason);

            const logRef = db.collection('guilds').doc(interaction.guildId!).collection('mod-logs');
            await logRef.add({
                action: 'kick',
                targetId: target.id,
                targetTag: target.user.tag,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                reason: reason,
                timestamp: Timestamp.now()
            });

            await interaction.editReply({ content: `Successfully kicked **${target.user.tag}** for: ${reason}` });

            await sendModLog({
                guild: interaction.guild,
                moderator: interaction.user,
                target: target.user,
                action: 'Kick',
                actionColor: 'Orange',
                reason: reason
            });

        } catch (error) {
            console.error('An error occurred during the kick process:', error);
            const errorMessage = { content: 'An unexpected error occurred. The user may have been kicked, but the action could not be logged.' };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }
};

export const data = command.data;