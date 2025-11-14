import { Client, GatewayIntentBits, Events, Collection } from 'discord.js';
import config from './config';
import { Command } from './types/command';
import fs from 'node:fs';
import path from 'node:path';
import { handleMessage } from './events/automod';
import { db } from './utils/firebase';

class AegisClient extends Client {
    commands: Collection<string, Command> = new Collection();
}

const client = new AegisClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// --- RECURSIVE COMMAND HANDLER ---
const commandsPath = path.join(__dirname, 'commands');

function loadCommands(directory: string) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
        const fullPath = path.join(directory, file);
        const stat = fs.lstatSync(fullPath);
        if (stat.isDirectory()) {
            // If it's a directory, recursively call this function.
            loadCommands(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
            // If it's a command file, load it.
            const { command } = require(fullPath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`[INFO] Loaded command: /${command.data.name}`);
            } else {
                console.log(`[WARNING] The command at ${fullPath} is missing a required "data" or "execute" property.`);
            }
        }
    }
}

loadCommands(commandsPath);

// --- EVENT LISTENERS ---
client.once(Events.ClientReady, (readyClient) => {
    console.log(`✅ Logged in as ${readyClient.user.tag}`);
    console.log(`🚀 Aegis Guardian is online and ready to protect servers!`);
});

client.on(Events.MessageCreate, async message => {
    await handleMessage(message);
});

client.on(Events.GuildMemberAdd, async member => {
    // Don't assign roles to bots
    if (member.user.bot) return;

    try {
        const guildDocRef = db.collection('guilds').doc(member.guild.id);
        const doc = await guildDocRef.get();

        const autoRoleId = doc.data()?.settings?.autoRoleId;
        if (!autoRoleId) return; // No autorole configured

        const role = member.guild.roles.cache.get(autoRoleId);
        if (!role) {
            console.warn(`[Autorole] Role ID ${autoRoleId} not found in guild ${member.guild.name}. Removing from settings.`);
            await guildDocRef.set({ settings: { autoRoleId: null } }, { merge: true });
            return;
        }

        // Check if bot can manage roles and role is assignable
        if (member.guild.members.me?.permissions.has('ManageRoles') && role.position < member.guild.members.me.roles.highest.position) {
            await member.roles.add(role, 'Automatic role assignment');
        } else {
            console.error(`[Autorole] Failed to assign role ${role.name} in ${member.guild.name}. Bot lacks permissions or role is too high.`);
            // You could log this to the mod-log channel here as a system error
        }

    } catch (error) {
        console.error(`[Autorole] Error assigning role in ${member.guild.name}:`, error);
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = (interaction.client as AegisClient).commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        // Reverted from using 'flags' to 'ephemeral: true' to fix the TypeScript error.
        const errorMessage = { content: 'There was an error while executing this command!', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

client.login(config.token);

