// src/types/command.ts

// Import the more specific types we need
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    SlashCommandOptionsOnlyBuilder 
} from 'discord.js';

export interface Command {

    data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
        execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}