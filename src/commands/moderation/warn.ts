import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  GuildMember,
  ChatInputCommandInteraction,
  EmbedBuilder,
  InteractionContextType,
} from "discord.js";
import { Command } from "../../types/command";
import { db } from "../../utils/firebase";
import { Timestamp } from "firebase-admin/firestore";
import { sendModLog } from "../../utils/logUtils";
import { parseDuration } from "../../utils/durationParser";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Issues a formal warning to a member.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild)
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("The member to warn")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for the warning")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    const target = interaction.options.getMember("target") as GuildMember;
    const reason = interaction.options.getString("reason", true);

    // --- Validation Checks ---
    if (!target) {
      /* ... */ return;
    }
    if (target.user.bot) {
      /* ... */ return;
    }
    if (
      target.id !== interaction.user.id &&
      target.roles.highest.position >=
        (interaction.member as GuildMember).roles.highest.position
    ) {
      // ...
      return;
    }

    try {
      // Attempt to send a DM to the user
      try {
        await target.user.send(
          `You have received a warning in **${interaction.guild.name}** for the following reason: ${reason}`
        );
      } catch (error) {
        console.warn(
          `Could not send DM to ${target.user.tag}. They may have DMs disabled.`
        );
      }

      // --- Log the warning to Firestore ---
      const logRef = db
        .collection("guilds")
        .doc(interaction.guild.id)
        .collection("mod-logs");
      await logRef.add({
        action: "warn",
        targetId: target.id,
        targetTag: target.user.tag,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        reason: reason,
        timestamp: Timestamp.now(),
      });

      const warnEmbed = new EmbedBuilder()
        .setTitle("User Warned")
        .setColor("Red")
        .setDescription(
          `User: **${target.user.tag}** has been warned for the following reason:\n\n${reason}`
        )
        .setTimestamp();

      // --- Public confirmation message ---
      await interaction.reply({ embeds: [warnEmbed] });

      // --- Send the public log embed ---
      await sendModLog({
        guild: interaction.guild,
        moderator: interaction.user,
        target: target.user,
        action: "Warn",
        actionColor: "Yellow",
        reason: reason,
      });

      // --- CHECK FOR WARNING ESCALATION ---
      await checkEscalation(interaction, target);
    } catch (error) {
      console.error("Error issuing warning:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content:
            "An unexpected error occurred while trying to issue the warning.",
          ephemeral: true,
        });
      }
    }
  },
};

async function checkEscalation(
  interaction: ChatInputCommandInteraction,
  target: GuildMember
) {
  if (!interaction.guild) return;

  const guildDocRef = db.collection("guilds").doc(interaction.guild.id);
  const doc = await guildDocRef.get();
  const rules = (doc.data()?.automod?.escalationRules ?? {}) as Record<
    string,
    any
  >;

  const logsRef = guildDocRef.collection("mod-logs");
  const warningsSnapshot = await logsRef
    .where("targetId", "==", target.id)
    .where("action", "in", ["warn", "auto-warn"])
    .get();
  const totalWarnings = warningsSnapshot.size;

  const rule = rules[totalWarnings] ?? rules[String(totalWarnings)];
  if (!rule) return; // No rule for this number of warnings

  const autoReason = `Automatic action for reaching ${totalWarnings} warnings.`;
  try {
    switch (rule.action) {
      case "mute":
        const durationMs = parseDuration(rule.duration || "1h"); // Default to 1h if no duration is set
        if (
          durationMs &&
          target.moderatable &&
          !target.isCommunicationDisabled()
        ) {
          await target.timeout(durationMs, autoReason);
          await interaction.followUp({
            content: `**${target.user.tag}** has been automatically muted for ${
              rule.duration || "1h"
            } for reaching ${totalWarnings} warnings.`,
          });
          await sendModLog({
            guild: interaction.guild,
            moderator: interaction.client.user,
            target: target.user,
            action: "Auto-Mute (Escalation)",
            actionColor: "DarkPurple",
            reason: autoReason,
            duration: rule.duration || "1h",
          });
        }
        break;
      case "kick":
        if (target.kickable) {
          await target.kick(autoReason);
          await interaction.followUp({
            content: `**${target.user.tag}** has been automatically kicked for reaching ${totalWarnings} warnings.`,
          });
          await sendModLog({
            guild: interaction.guild,
            moderator: interaction.client.user,
            target: target.user,
            action: "Auto-Kick (Escalation)",
            actionColor: "DarkOrange",
            reason: autoReason,
          });
        }
        break;
      case "ban":
        if (target.bannable) {
          await target.ban({ reason: autoReason });
          await interaction.followUp({
            content: `**${target.user.tag}** has been automatically banned for reaching ${totalWarnings} warnings.`,
          });
          await sendModLog({
            guild: interaction.guild,
            moderator: interaction.client.user,
            target: target.user,
            action: "Auto-Ban (Escalation)",
            actionColor: "DarkRed",
            reason: autoReason,
          });
        }
        break;
    }
  } catch (error) {
    console.error("Error during warning escalation:", error);
    await interaction.followUp({
      content: `Failed to execute automatic action for ${target.user.tag}.`,
      ephemeral: true,
    });
  }
}

export const data = command.data;
