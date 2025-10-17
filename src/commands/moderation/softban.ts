// src/commands/moderation/softban.ts

import { SlashCommandBuilder, PermissionFlagsBits, GuildMember, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Command } from '../../types/command';

// This command bans and immediately unbans a member to delete their recent messages.
export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('softban')
        .setDescription('Kicks a member and deletes their recent messages.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers) // This action requires ban permissions
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The member to softban')
                .setRequired(true))
        .addIntegerOption(option =>
            option
                .setName('delete_messages')
                .setDescription('How much of their recent message history to delete.')
                .addChoices(
                    { name: 'Previous 24 hours', value: 1 },
                    { name: 'Previous 7 days', value: 7 }
                )
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('The reason for the softban')),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: [MessageFlags.Ephemeral] });
            return;
        }

        const target = interaction.options.getMember('target') as GuildMember;
        const deleteMessageDays = interaction.options.getInteger('delete_messages', true);
        const reason = interaction.options.getString('reason') ?? 'No reason provided';

        // --- Validation Checks ---
        if (!target) {
            await interaction.reply({ content: "That user isn't in this server.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        if (target.id === interaction.user.id) {
            await interaction.reply({ content: "You can't softban yourself!", flags: [MessageFlags.Ephemeral] });
            return;
        }

        if (target.id === interaction.client.user.id) {
            await interaction.reply({ content: "You can't softban me!", flags: [MessageFlags.Ephemeral] });
            return;
        }

        if (target.roles.highest.position >= (interaction.member as GuildMember).roles.highest.position) {
             await interaction.reply({ content: "You can't softban a member with an equal or higher role than you.", flags: [MessageFlags.Ephemeral] });
             return;
        }

        if (!target.bannable) {
            await interaction.reply({ content: "I don't have permission to perform this action on that member.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        // --- Execution ---
        try {
            // Defer the reply to ensure we don't time out during the ban/unban process
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            // Step 1: Ban the user to trigger message deletion
            await interaction.guild.members.ban(target, {
                deleteMessageDays: deleteMessageDays,
                reason: `Softban executed by ${interaction.user.tag} for: ${reason}`
            });

            // Step 2: Immediately unban the user
            await interaction.guild.members.unban(target.id, 'Softban: Automatic unban');
            
            // Step 3: Edit the deferred reply to confirm the action
            await interaction.editReply({ 
                content: `Successfully softbanned **${target.user.tag}** and deleted their messages from the last ${deleteMessageDays} day(s). They are free to rejoin.` 
            });

        } catch (error) {
            console.error('Error during softban:', error);
            // If we already deferred, we need to edit the reply for the error message
            if (interaction.deferred) {
                await interaction.editReply({ content: 'An unexpected error occurred while trying to softban the member.' });
            } else {
                await interaction.reply({ content: 'An unexpected error occurred while trying to softban the member.', flags: [MessageFlags.Ephemeral] });
            }
        }
    }
};

export const data = command.data;