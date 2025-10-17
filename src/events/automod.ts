// src/events/automod.ts

import { Collection, Message, PermissionFlagsBits, TextChannel } from 'discord.js';
import { db } from '../utils/firebase';
import { sendModLog } from '../utils/logUtils';
import { Timestamp } from 'firebase-admin/firestore';

// --- Banned Words Cache ---
const guildSettingsCache = new Map<string, { bannedWords: string[] }>();
async function fetchSettings(guildId: string) {
    if (guildSettingsCache.has(guildId)) {
        return guildSettingsCache.get(guildId);
    }
    const doc = await db.collection('guilds').doc(guildId).get();
    const settings = doc.data()?.automod || { bannedWords: [] };
    guildSettingsCache.set(guildId, settings);
    setTimeout(() => guildSettingsCache.delete(guildId), 5 * 60 * 1000);
    return settings;
}

// --- Anti-Spam Tracker ---
const userSpamTracker = new Collection<string, { msgCount: number, lastMsgTime: number }>();
const SPAM_THRESHOLD = 5;
const SPAM_TIMEFRAME = 3000;
const SPAM_MUTE_DURATION_MS = 5 * 60 * 1000;
const SPAM_MUTE_DURATION_STRING = '5 minutes';

export async function handleMessage(message: Message) {
    if (message.author.bot || !message.guild || !message.member) return;
    if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

    // --- Anti-Spam Logic ---
    const userKey = `${message.guild.id}-${message.author.id}`;
    const now = Date.now();
    const userData = userSpamTracker.get(userKey) || { msgCount: 0, lastMsgTime: now };

    if (now - userData.lastMsgTime > SPAM_TIMEFRAME) {
        userData.msgCount = 1;
        userData.lastMsgTime = now;
    } else {
        userData.msgCount++;
    }
    userSpamTracker.set(userKey, userData);

    if (userData.msgCount >= SPAM_THRESHOLD) {
        // We still check if the channel is text-based as a good practice.
        if (!message.channel.isTextBased()) return;
        try {
            if (!message.member.isCommunicationDisabled() && message.member.moderatable) {
                await message.member.timeout(SPAM_MUTE_DURATION_MS, 'Automatic spam detection.');

                // FORCE THE FIX: Explicitly cast the channel type here.
                const channel = message.channel as TextChannel;
                const reply = await channel.send(`${message.author} has been automatically muted for spamming.`);
                setTimeout(() => reply.delete().catch(console.error), 5000);

                await sendModLog({
                    guild: message.guild,
                    moderator: message.client.user,
                    target: message.author,
                    action: 'Auto-Mute (Spam)',
                    actionColor: 'DarkPurple',
                    reason: 'User sent messages too quickly.',
                    duration: SPAM_MUTE_DURATION_STRING
                });
            }
        } catch (error) {
            console.error("Error during anti-spam mute:", error);
        }
        userSpamTracker.delete(userKey);
        return;
    }

    // --- Banned Words Logic ---
    const settings = await fetchSettings(message.guild.id);
    const bannedWords = settings?.bannedWords || [];
    if (bannedWords.length === 0) return;

    const messageContent = message.content.toLowerCase();
    const foundWord = bannedWords.find((word: string) => messageContent.includes(word));

    if (foundWord) {
        if (!message.channel.isTextBased()) return;
        try {
            await message.delete();
            const channel = message.channel as TextChannel;
            const reply = await channel.send(`${message.author}, that word is not allowed here.`);
            setTimeout(() => reply.delete().catch(console.error), 5000);

            const logRef = db.collection('guilds').doc(message.guild.id).collection('mod-logs');
            await logRef.add({
                action: 'auto-warn',
                targetId: message.author.id,
                targetTag: message.author.tag,
                moderatorId: message.client.user.id,
                moderatorTag: message.client.user.tag,
                reason: `Automatic detection of blacklisted word: "${foundWord}"`,
                timestamp: Timestamp.now()
            });

            await sendModLog({
                guild: message.guild,
                moderator: message.client.user,
                target: message.author,
                action: 'Auto-Warn (Banned Word)',
                actionColor: 'DarkRed',
                reason: `Contained the word: \`${foundWord}\``
            });
        } catch (error) {
            console.error("Error during banned word action:", error);
        }
    }
}

