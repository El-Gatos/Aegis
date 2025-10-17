import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

// Defines the structure that every command file must follow.
export interface Command {
    // 'data' holds the command's definition. Using SlashCommandBuilder directly
    // is more flexible and resolves the type mismatch errors.
    data: SlashCommandBuilder;
    
    // 'execute' is the function that runs when the command is used.
    // We use ChatInputCommandInteraction to ensure the '.options' property is available.
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

