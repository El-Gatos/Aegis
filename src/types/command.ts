import { SlashCommandBuilder, CommandInteraction } from 'discord.js';

// Defines the structure that every command file must follow.
// This ensures consistency and helps TypeScript catch errors.
export interface Command {
    // 'data' holds the command's definition for registration with Discord.
    // SlashCommandBuilder is used to construct this definition.
    data: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
    
    // 'execute' is the function that runs when the command is used.
    // It receives the 'interaction' object, which contains all the information
    // about the user's command invocation.
    execute: (interaction: CommandInteraction) => Promise<void>;
}
