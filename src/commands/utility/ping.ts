import { SlashCommandBuilder, CommandInteraction } from "discord.js";
import { Command } from "../../types/command";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Checks the bot's latency."),

  async execute(interaction: CommandInteraction) {
    const sentMessage = await interaction.reply({
      content: "Pinging...",
      fetchReply: true,
      ephemeral: true,
    });

    const roundtripLatency =
      sentMessage.createdTimestamp - interaction.createdTimestamp;

    const websocketPing = interaction.client.ws.ping;
    await interaction.editReply(
      `Pong! 🏓\n` +
        `**API Latency:** ${roundtripLatency}ms\n` +
        `**WebSocket Ping:** ${websocketPing}ms`
    );
  },
};

export const data = command.data;
