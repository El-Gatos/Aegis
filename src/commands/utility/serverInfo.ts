// src/commands/utility/serverinfo.ts

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ChannelType,
  InteractionContextType,
} from "discord.js";
import { Command } from "../../types/command";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Displays information about the current server.")
    .setContexts(InteractionContextType.Guild),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    // Fetch the guild owner
    const owner = await interaction.guild.fetchOwner();

    // Channel counts
    const channels = interaction.guild.channels.cache;
    const textChannels = channels.filter(
      (c) => c.type === ChannelType.GuildText
    ).size;
    const voiceChannels = channels.filter(
      (c) => c.type === ChannelType.GuildVoice
    ).size;
    const categories = channels.filter(
      (c) => c.type === ChannelType.GuildCategory
    ).size;

    const infoEmbed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle(interaction.guild.name)
      .setThumbnail(interaction.guild.iconURL())
      .addFields(
        {
          name: "Owner",
          value: `${owner.user.tag} (${owner.id})`,
          inline: true,
        },
        {
          name: "Total Members",
          value: interaction.guild.memberCount.toString(),
          inline: true,
        },
        {
          name: "Created At",
          value: `<t:${Math.floor(
            interaction.guild.createdTimestamp / 1000
          )}:F>`, // e.g., "August 30, 2018 1:17 PM"
          inline: true,
        },
        {
          name: "Channels",
          value: `**${textChannels}** Text | **${voiceChannels}** Voice | **${categories}** Categories`,
          inline: false,
        },
        {
          name: "Role Count",
          value: interaction.guild.roles.cache.size.toString(),
          inline: true,
        },
        {
          name: "Emoji Count",
          value: interaction.guild.emojis.cache.size.toString(),
          inline: true,
        }
      )
      .setFooter({ text: `ID: ${interaction.guild.id}` })
      .setTimestamp();

    await interaction.reply({ embeds: [infoEmbed] });
  },
};

export const data = command.data;
