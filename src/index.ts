import {
  Client,
  GatewayIntentBits,
  Events,
  Collection,
  Partials,
  EmbedBuilder,
  Message,
  PermissionFlagsBits,
  TextChannel,
  Guild, // Added this
  GuildMember, // Added this
  Interaction, // Added this
  Role, // Added this
} from "discord.js";
import config from "./config";
import { Command } from "./types/command";
import * as bcrypt from "bcrypt";
import fs from "node:fs";
import path from "node:path";
import { handleMessage } from "./events/automod";
import { db } from "./utils/firebase";
import { FieldValue } from "firebase-admin/firestore";

class AegisClient extends Client {
  commands: Collection<string, Command> = new Collection();
}

const client = new AegisClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember,
  ],
});

const commandsPath = path.join(__dirname, "commands");

function loadCommands(directory: string) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.lstatSync(fullPath);
    if (stat.isDirectory()) {
      loadCommands(fullPath);
    } else if (file.endsWith(".ts") || file.endsWith(".js")) {
      const { command } = require(fullPath);
      if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
        console.log(`[INFO] Loaded command: /${command.data.name}`);
      } else {
        console.log(
          `[WARNING] The command at ${fullPath} is missing a required "data" or "execute" property.`
        );
      }
    }
  }
}

loadCommands(commandsPath);

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);
  console.log(`🚀 Aegis Guardian is online and ready to protect servers!`);
});

// --- CORRECTED MESSAGE CREATE LISTENER ---
client.on(Events.MessageCreate, async (message) => {
  // Always ignore other bots
  if (message.author.bot) return;

  // --- Guild Message Router ---
  if (message.guild) {
    // This is a message in a server, run automod
    await handleMessage(message);
    return;
  }

  // --- DM Message Router ---
  if (!message.guild) {
    // This is a DM, check for recovery command
    if (message.content.startsWith("!recover")) {
      // This now calls the one, global handleRecoveryDm function
      await handleRecoveryDm(message);
    }
    return;
  }
});

// --- THE ONE, CORRECT RECOVERY FUNCTION ---
async function handleRecoveryDm(message: Message) {
  const token = message.content.substring(8).trim(); // Removes '!recover '
  if (!token.includes(".")) {
    await message.author.send(
      "Invalid token format. It should look like `[GuildID].[SecretKey]`."
    );
    return;
  }

  const [guildId, secretKey] = token.split(".");
  if (!guildId || !secretKey) {
    await message.author.send("Invalid token format.");
    return;
  }

  try {
    // 1. Fetch the stored hash from Firestore
    const guildDocRef = db.collection("guilds").doc(guildId);
    const doc = await guildDocRef.get();
    const storedHash = doc.data()?.settings?.recoveryTokenHash;

    if (!storedHash) {
      await message.author.send(
        "Invalid or expired token. No recovery token is set for that server."
      );
      return;
    }

    // 2. Compare the provided key with the stored hash
    const isValid = await bcrypt.compare(secretKey, storedHash);

    if (!isValid) {
      await message.author.send("Invalid or expired token.");
      return;
    }

    // --- TOKEN IS VALID ---
    await message.author.send(
      `Token accepted for server ${
        doc.data()?.name || guildId
      }. Granting access...`
    );

    // 3. Fetch the guild and member
    const guild = await message.client.guilds.fetch(guildId);
    const member = await guild.members.fetch(message.author.id);
    if (!member) {
      await message.author.send(
        "I found the server, but you are not a member. Please join the server and try again."
      );
      return;
    }

    // 4. Find or Create the "Recovery Admin" role
    let recoveryRole = guild.roles.cache.find(
      (r) => r.name === "Recovery Admin"
    );

    if (!recoveryRole) {
      // Role doesn't exist, create it
      await message.author.send(
        'The "Recovery Admin" role was not found. I will try to create it...'
      );

      const botMember = guild.members.me!;
      if (!botMember.permissions.has("ManageRoles")) {
        await message.author.send(
          `Error: I do not have the "Manage Roles" permission in ${guild.name} to create the recovery role.`
        );
        return;
      }

      try {
        recoveryRole = await guild.roles.create({
          name: "Recovery Admin",
          permissions: [PermissionFlagsBits.Administrator],
          // Set position just below the bot's highest role
          position: botMember.roles.highest.position,
          reason: "Automatic creation for recovery command",
        });
        await message.author.send(
          `Successfully created the "Recovery Admin" role.`
        );
      } catch (createError) {
        console.error("Failed to create recovery role:", createError);
        await message.author.send(
          `Error: I tried to create the role but failed. Please check my permissions. I need "Manage Roles" and "Administrator".`
        );
        return;
      }
    }

    // 5. Check bot hierarchy
    if (recoveryRole.position >= guild.members.me!.roles.highest.position) {
      await message.author.send(
        `Error: I cannot assign the "Recovery Admin" role. It is higher than my highest role. Please fix its position in the server settings.`
      );
      return;
    }

    // 6. Grant the role
    await member.roles.add(recoveryRole, "Used one-time recovery token");

    // 7. --- CRITICAL: Invalidate the token ---
    await guildDocRef.update({
      "settings.recoveryTokenHash": FieldValue.delete(),
    });

    // 8. Log the action to the guild's mod channel
    const logChannelId = doc.data()?.settings?.logChannelId;
    if (logChannelId) {
      const logChannel = (await guild.channels.fetch(
        logChannelId
      )) as TextChannel;
      const logEmbed = new EmbedBuilder()
        .setColor("Red")
        .setAuthor({ name: "CRITICAL SECURITY EVENT" })
        .setTitle("Recovery Token Used")
        .addFields(
          { name: "User", value: `${member.user.tag} (${member.id})` },
          {
            name: "Action",
            value: `The one-time recovery token was successfully used and has been **permanently invalidated**.\nThe user was granted the \`${recoveryRole.name}\` role.`,
          }
        )
        .setTimestamp();
      await logChannel.send({ embeds: [logEmbed] });
    }

    await message.author.send(
      `✅ You have been granted the "Recovery Admin" role in **${guild.name}**. The token has been used and is now invalid.`
    );
  } catch (error) {
    console.error("Error in handleRecoveryDm:", error);
    await message.author.send(
      "An unexpected error occurred. Could not fetch server or role. Please try again."
    );
  }
}

// --- OTHER LISTENERS ---
client.on(Events.GuildMemberAdd, async (member) => {
  if (member.user.bot) return;

  try {
    const guildDocRef = db.collection("guilds").doc(member.guild.id);
    const doc = await guildDocRef.get();

    const autoRoleId = doc.data()?.settings?.autoRoleId;
    if (!autoRoleId) return;

    const role = member.guild.roles.cache.get(autoRoleId);
    if (!role) {
      console.warn(
        `[Autorole] Role ID ${autoRoleId} not found in guild ${member.guild.name}. Removing from settings.`
      );
      await guildDocRef.set(
        { settings: { autoRoleId: null } },
        { merge: true }
      );
      return;
    }

    if (
      member.guild.members.me?.permissions.has("ManageRoles") &&
      role.position < member.guild.members.me.roles.highest.position
    ) {
      await member.roles.add(role, "Automatic role assignment");
    } else {
      console.error(
        `[Autorole] Failed to assign role ${role.name} in ${member.guild.name}. Bot lacks permissions or role is too high.`
      );
    }
  } catch (error) {
    console.error(
      `[Autorole] Error assigning role in ${member.guild.name}:`,
      error
    );
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  // --- Note: This only handles slash commands. ---
  // --- Your reaction role code is in separate listeners below ---
  if (!interaction.isChatInputCommand()) return;
  const command = (interaction.client as AegisClient).commands.get(
    interaction.commandName
  );

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const errorMessage = {
      content: "There was an error while executing this command!",
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// --- REACTION ROLE LISTENERS ---
function getEmojiIdentifier(reaction: any): string | null {
  if (reaction.emoji.id) return reaction.emoji.id;
  if (reaction.emoji.name) return reaction.emoji.name;
  return null;
}

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (reaction.partial) await reaction.fetch();
  if (user.partial) await user.fetch();
  if (user.bot) return;
  if (!reaction.message.guild) return;

  const emoji = getEmojiIdentifier(reaction);
  if (!emoji) return;

  const docId = `${reaction.message.guild.id}-${reaction.message.id}-${emoji}`;
  const ruleDoc = await db.collection("reaction_roles").doc(docId).get();

  if (!ruleDoc.exists) return;

  try {
    const rule = ruleDoc.data();
    const role = reaction.message.guild.roles.cache.get(rule!.roleId);
    const member = await reaction.message.guild.members.fetch(user.id);

    if (role && member) {
      if (
        reaction.message.guild.members.me!.permissions.has("ManageRoles") &&
        role.position <
          reaction.message.guild.members.me!.roles.highest.position
      ) {
        await member.roles.add(role, "Reaction Role");
      } else {
        console.warn(
          `[ReactionRole] Failed to add role ${role.name} to ${member.user.tag}. Bot perms/hierarchy issue.`
        );
      }
    }
  } catch (error) {
    console.error("Error adding reaction role:", error);
  }
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (reaction.partial) await reaction.fetch();
  if (user.partial) await user.fetch();
  if (user.bot) return;
  if (!reaction.message.guild) return;

  const emoji = getEmojiIdentifier(reaction);
  if (!emoji) return;

  const docId = `${reaction.message.guild.id}-${reaction.message.id}-${emoji}`;
  const ruleDoc = await db.collection("reaction_roles").doc(docId).get();

  if (!ruleDoc.exists) return;

  try {
    const rule = ruleDoc.data();
    const role = reaction.message.guild.roles.cache.get(rule!.roleId);
    const member = await reaction.message.guild.members.fetch(user.id);

    if (role && member) {
      if (
        reaction.message.guild.members.me!.permissions.has("ManageRoles") &&
        role.position <
          reaction.message.guild.members.me!.roles.highest.position
      ) {
        await member.roles.remove(role, "Reaction Role");
      } else {
        console.warn(
          `[ReactionRole] Failed to remove role ${role.name} from ${member.user.tag}. Bot perms/hierarchy issue.`
        );
      }
    }
  } catch (error) {
    console.error("Error removing reaction role:", error);
  }
});

client.login(config.token);
