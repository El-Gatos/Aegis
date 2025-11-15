import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, MessageFlags, EmbedBuilder, InteractionContextType } from 'discord.js';
import { Command } from '../../types/command';
import { db } from '../../utils/firebase';
import { Timestamp } from 'firebase-admin/firestore';

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('modhistory')
        .setDescription("Checks a user's moderation history in this server.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setContexts(InteractionContextType.Guild)
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The user to check the history for')
                .setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;

        const target = interaction.options.getUser('target', true);

        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const logsRef = db.collection('guilds').doc(interaction.guildId).collection('mod-logs');
            const snapshot = await logsRef.where('targetId', '==', target.id).orderBy('timestamp', 'desc').get();

            if (snapshot.empty) {
                await interaction.editReply({ content: `No moderation history found for **${target.tag}**.` });
                return;
            }

            const historyEmbed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setAuthor({ name: `Moderation History for ${target.tag}`, iconURL: target.displayAvatarURL() })
                .setTimestamp();

            let description = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const timestamp = (data.timestamp as Timestamp).toDate();
                const discordTimestamp = `<t:${Math.floor(timestamp.getTime() / 1000)}:R>`;

                description += `**Action:** ${data.action.toUpperCase()}\n`; // <--- Change 'type' to 'action'
                description += `**Reason:** ${data.reason}\n`;
                description += `**Moderator:** ${data.moderatorTag}\n`;
                description += `**Date:** ${discordTimestamp}\n\n`;
            });
            historyEmbed.setDescription(description);

            await interaction.editReply({ embeds: [historyEmbed] });

        } catch (error) {
            console.error("Error fetching mod history:", error);
            await interaction.editReply({ content: "An error occurred while fetching the user's history." });
        }
    }
};

export const data = command.data;