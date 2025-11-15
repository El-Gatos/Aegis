import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  MessageFlags,
  TextChannel,
  InteractionContextType,
} from "discord.js";
import { Command } from "../../types/command";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Deletes a specified number of messages from a channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("The number of messages to delete (1-100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("Optional: Only delete messages from this user")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.channel instanceof TextChannel)) {
      await interaction.reply({
        content: "This command can only be used in a server text channel.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const amount = interaction.options.getInteger("amount", true);
    const target = interaction.options.getUser("target");

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    try {
      const messages = await interaction.channel.messages.fetch({
        limit: amount,
      });
      let messagesToDelete = messages;

      if (target) {
        messagesToDelete = messages.filter((m) => m.author.id === target.id);
      }

      if (messagesToDelete.size === 0) {
        await interaction.editReply({
          content: `No messages found to delete.`,
        });
        return;
      }

      const deletedMessages = await interaction.channel.bulkDelete(
        messagesToDelete,
        true
      );

      let confirmationMessage = `Successfully deleted ${deletedMessages.size} message(s).`;
      if (target) {
        confirmationMessage += ` from **${target.tag}**.`;
      }

      await interaction.editReply({ content: confirmationMessage });
    } catch (error) {
      console.error("Error during purge:", error);
      await interaction.editReply({
        content:
          "An error occurred. I may not have permission to delete messages, or some messages were older than 14 days.",
      });
    }
  },
};

export const data = command.data;
