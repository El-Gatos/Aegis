// src/utils/logUtils.ts

import { EmbedBuilder, Guild, User, ColorResolvable } from 'discord.js';
import { db } from './firebase';

interface ModLogOptions {
    guild: Guild;
    moderator: User;
    target: User;
    action: string;
    actionColor: ColorResolvable;
    reason?: string;
    duration?: string;
}

export async function sendModLog(options: ModLogOptions) {
    try {
        const guildDocRef = db.collection('guilds').doc(options.guild.id);
        const guildDoc = await guildDocRef.get();

        if (!guildDoc.exists) return;

        const guildData = guildDoc.data();
        const logChannelId = guildData?.settings?.logChannelId;

        if (!logChannelId) return; // No log channel configured

        const logChannel = await options.guild.channels.fetch(logChannelId);
        if (!logChannel || !logChannel.isTextBased()) return;

        const logEmbed = new EmbedBuilder()
            .setColor(options.actionColor)
            .setAuthor({ name: 'Moderation Log' })
            .setTitle(`Action: ${options.action}`)
            .addFields(
                { name: 'Target User', value: `${options.target.tag} (${options.target.id})`, inline: true },
                { name: 'Moderator', value: `${options.moderator.tag} (${options.moderator.id})`, inline: true },
            )
            .setTimestamp()
            .setFooter({ text: `Aegis Guardian | ${options.guild.name}` });

        if (options.reason) {
            logEmbed.addFields({ name: 'Reason', value: options.reason });
        }

        if (options.duration) {
            logEmbed.addFields({ name: 'Duration', value: options.duration, inline: true });
        }

        await logChannel.send({ embeds: [logEmbed] });

    } catch (error) {
        console.error("Failed to send moderation log:", error);
    }
}