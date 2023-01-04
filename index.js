const dotenv = require('dotenv')
const { Client, GatewayIntentBits } = require('discord.js')
const quiz = require('./quiz.js')

dotenv.config()

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
})

client.on('messageCreate', async (message) => {
  if (!message.author.bot && message.channel.name === process.env.CHANNEL_NAME) {
    quiz.onMessage(message)
  }
})

client.login(process.env.DISCORD_TOKEN)
