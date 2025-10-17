import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits, GuildMember } from 'discord.js';
import { Command } from '../../types/command';

// This command allows a moderator to kick a member from the server.
export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Select a member and kick them from the server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .setDMPermission(false)
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The member to kick')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('The reason for kicking the member')),

    async execute(interaction: CommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const target = interaction.options.getMember('target') as GuildMember;
        const reason = interaction.options.getString('reason') ?? 'No reason provided';

        if (!target) {
            await interaction.reply({ content: "That user isn't in this server.", ephemeral: true });
            return;
        }

        if (target.id === interaction.user.id) {
            await interaction.reply({ content: "You can't kick yourself!", ephemeral: true });
            return;
        }

        if (target.id === interaction.client.user.id) {
            await interaction.reply({ content: "You can't kick me!", ephemeral: true });
            return;
        }

        if (target.roles.highest.position >= (interaction.member as GuildMember).roles.highest.position) {
             await interaction.reply({ content: "You can't kick a member with an equal or higher role than you.", ephemeral: true });
             return;
        }

        if (!target.kickable) {
            await interaction.reply({ content: "I don't have permission to kick that member. They may have a higher role than me.", ephemeral: true });
            return;
        }

        try {
            await target.send(`You have been kicked from **${interaction.guild.name}** for the following reason: ${reason}`);
        } catch (error) {
            console.warn(`Could not send DM to ${target.user.tag}. They may have DMs disabled.`);
        }

        try {
            await target.kick(reason);
            await interaction.reply({ content: `Successfully kicked **${target.user.tag}** for: ${reason}`, ephemeral: true });
        } catch (error) {
            console.error('Error kicking member:', error);
            await interaction.reply({ content: 'An unexpected error occurred while trying to kick the member.', ephemeral: true });
        }
    }
};

// We export the command data for the deployment script.
export const data = command.data;

