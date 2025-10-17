import { Client, GatewayIntentBits, Events, Collection } from 'discord.js';
import config from './config';
import { Command } from './types/command';
import fs from 'node:fs';
import path from 'node:path';

// We are extending the base Client class to include a 'commands' property.
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
// This new handler searches through subfolders to find and load all command files.
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

