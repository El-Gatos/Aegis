import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  MessageFlags,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  TextChannel,
  InteractionContextType,
} from "discord.js";
import { Command } from "../../types/command";
import { db } from "../../utils/firebase";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Manages the server's CAPTCHA verification system.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("setup")
        .setDescription("Posts the verification message in this channel.")
        .addRoleOption((option) =>
          option
            .setName("role")
            .setDescription("The role to grant upon successful verification")
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (
      !interaction.guildId ||
      !interaction.guild ||
      !(interaction.channel instanceof TextChannel)
    ) {
      await interaction.reply({
        content: "This command can only be used in a server text channel.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "setup") {
      const verifiedRole = interaction.options.getRole("role", true);

      // --- Permission Check ---
      const botMember = await interaction.guild.members.fetch(
        interaction.client.user.id
      );
      if (verifiedRole.position >= botMember.roles.highest.position) {
        await interaction.reply({
          content: `❌ I cannot assign the **${verifiedRole.name}** role because it is higher than or equal to my highest role.`,
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      // --- Save Setting to DB ---
      // We save the role ID to be used by the button listener later
      const guildDocRef = db.collection("guilds").doc(interaction.guildId);
      await guildDocRef.set(
        {
          settings: {
            verificationRoleId: verifiedRole.id,
          },
        },
        { merge: true }
      );

      // --- Create Embed and Button ---
      const verifyEmbed = new EmbedBuilder()
        .setTitle("Verification Required")
        .setDescription(
          `To gain access to **${interaction.guild.name}**, please click the button below to prove you're human.`
        )
        .setColor("Blue");

      const verifyButton = new ButtonBuilder()
        .setCustomId("start_verification") // This ID will be caught by our new listener
        .setLabel("Click to Verify")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✅");

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        verifyButton
      );

      // --- Send Message ---
      try {
        await interaction.channel.send({
          embeds: [verifyEmbed],
          components: [row],
        });
        await interaction.editReply({
          content: `✅ Verification message has been posted. I will grant the **${verifiedRole.name}** role.`,
        });
      } catch (error) {
        console.error("Failed to post verification message:", error);
        const errorReply = {
          content:
            "I failed to post the message. Do I have 'Send Messages' and 'Embed Links' permissions in this channel?",
          ephemeral: true,
        };
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(errorReply);
        } else {
          await interaction.reply(errorReply);
        }
      }
    }
  },
};

export const data = command.data;
