// src/types/command.ts

// Import the more specific types we need
import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    SlashCommandOptionsOnlyBuilder,
    SlashCommandSubcommandsOnlyBuilder // <-- Import this new type
} from 'discord.js';

export interface Command {
    // Add the new type to the union
    data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}