import { CommandInteraction, Message, MessageEmbed } from 'discord.js';

export default {
    name: 'verify',
    description: 'Start emoji-based verification for users.',
    async execute(interaction: CommandInteraction) {
        const verificationChannel = interaction.channel;
        const verificationRole = interaction.guild?.roles.cache.find(role => role.name === 'Verified');
        const emoji = '✅'; // Use your desired emoji

        if (!verificationChannel || !verificationRole) {
            await interaction.reply({ content: 'Setup incomplete. Channel or role missing.', ephemeral: true });
            return;
        }

        const verificationMsg = await verificationChannel.send({
            embeds: [
                new MessageEmbed()
                    .setTitle('Welcome!')
                    .setDescription(`React with ${emoji} to verify and gain access to the server.`)
                    .setColor('#4caf50')
            ]
        });

        await verificationMsg.react(emoji);

        const filter = (reaction: any, user: any) => reaction.emoji.name === emoji && !user.bot;
        const collector = verificationMsg.createReactionCollector({ filter, dispose: true, time: 3600000 }); // 1 hour

        collector.on('collect', async (reaction, user) => {
            const member = await interaction.guild?.members.fetch(user.id);
            if (member && !member.roles.cache.has(verificationRole.id)) {
                await member.roles.add(verificationRole);
                user.send('You have been verified!');
            }
        });
    }
};
