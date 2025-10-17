import { REST, Routes } from 'discord.js';
import config from './config';
import fs from 'node:fs';
import path from 'node:path';

// --- SAFETY CHECK ---
// We add this check to ensure the required credentials are provided before proceeding.
// This satisfies TypeScript and prevents runtime errors.
if (!config.token || !config.clientId) {
    throw new Error("Missing required environment variables (BOT_TOKEN, CLIENT_ID). Please check your .env file.");
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

// New recursive function to find all command files
function findCommandFiles(directory: string): string[] {
    let files: string[] = [];
    const items = fs.readdirSync(directory);
    for (const item of items) {
        const fullPath = path.join(directory, item);
        const stat = fs.lstatSync(fullPath);
        if (stat.isDirectory()) {
            files = files.concat(findCommandFiles(fullPath));
        } else if (item.endsWith('.ts') || item.endsWith('.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

const commandFiles = findCommandFiles(commandsPath);

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
    const { data } = require(file);
    if (data) {
        commands.push(data.toJSON());
        console.log(`[DEPLOY] Found command for deployment: /${data.name}`);
    } else {
        console.log(`[WARNING] The command at ${file} is missing a "data" property.`);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(config.token);

// and deploy your commands!
(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        const data: any = await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands },
        );

        console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        // And of course, make sure you catch and log any errors!
        console.error(error);
    }
})();

