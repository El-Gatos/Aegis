import { SlashCommandBuilder, CommandInteraction, MessageFlags } from 'discord.js';
import { Command } from '../../types/command';

// This command calculates and displays the bot's latency.
export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription("Checks the bot's latency."),

    async execute(interaction: CommandInteraction) {
        const sentMessage = await interaction.reply({
            content: 'Pinging...',
            fetchReply: true,
            flags: [MessageFlags.Ephemeral]
        });

        // The roundtrip latency is the difference between when the initial reply was sent
        // and when the user's command was created. This measures the time it takes for
        // the command to travel from the user to the bot and back.
        const roundtripLatency = sentMessage.createdTimestamp - interaction.createdTimestamp;

        // The client's WebSocket heartbeat ping is a direct measure of the connection
        // health between your bot and Discord's servers.
        const websocketPing = interaction.client.ws.ping;

        // Edit the original reply to include the detailed latency information.
        await interaction.editReply(
            `Pong! 🏓\n` +
            `**API Latency:** ${roundtripLatency}ms\n` +
            `**WebSocket Ping:** ${websocketPing}ms`
        );
    }
};

export const data = command.data;

