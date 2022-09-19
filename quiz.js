const dotenv = require('dotenv')
const spreadsheet = require('./spreadsheet.js')

dotenv.config()

const prefix = '!'
const row_descr = 1
const row_quiz = 3

let quiz = {
  channel: [],
  state: 'waiting',
  list: [],
  rounds: 0,
  now: {},
  completed: 0,
  scoreStats: {},

  async set(channel, sheetList, rounds) {
    this.channel = channel
    this.state = 'playing'
    this.list = (
      await Promise.all(sheetList.map((sheet) => spreadsheet.getSheetData(sheet + `!${row_quiz}:1000`)))
    ).flatMap(([...v]) => v)
    this.rounds = Math.min(this.list.length, rounds)
    this.completed = 0
    this.now = {}
    this.scoreStats = {}

    // shuffle quiz.list
    for (let i = 0; i < rounds; ++i) {
      const j = Math.floor(Math.random() * (this.list.length - i)) + i
      ;[this.list[i], this.list[j]] = [this.list[j], this.list[i]]
    }
  },
  setNext() {
    ++this.completed
    if (this.completed === this.rounds) {
      this.halt()
    } else {
      this.send()
      console.log('next: ' + this.now.problem)
    }
  },
  halt() {
    this.state = 'waiting'
    this.channel.send({
      embeds: [
        {
          title: 'Game Ended.',
          description: Object.entries(this.scoreStats)
            .map(([user, score]) => `${score.correct} ✅\t${score.wrong} ❌\t${user}`)
            .join('\n'),
        },
      ],
    })
  },
  send() {
    const [problem, imageURL, ...answers] = this.list[this.completed]
    this.now = { problem, imageURL, answers }
    this.channel.send({
      embeds: [{ title: problem, image: { url: imageURL }, fields: [] }],
    })
  },
  hint() {
    const formatter = new Intl.ListFormat('en', { style: 'long', type: 'disjunction' })
    const hint = formatter.format(this.now.answers.map((ans) => ans[0]))
    this.channel.send('Correct answer begins with ' + hint)
  },
  judge(message) {
    const author = message.author
    if (!(author in this.scoreStats)) {
      this.scoreStats[author] = { correct: 0, wrong: 0 }
    }
    if (this.now.answers.includes(`${message}`)) {
      ++this.scoreStats[author].correct
      message.react('✅')
      this.channel.send('Correct!')
      this.setNext()
    } else {
      ++this.scoreStats[author].wrong
      message.react('❌')
    }
  },
}

const sendCommandList = async (channel, sheetList) => {
  const sheetDescriptions = await Promise.all(
    sheetList.map((sheet) => spreadsheet.getSheetData(sheet + `!B${row_descr}:B${row_descr}`))
  )
  const operationDescriptions = {
    '<quiz> <rounds>': 'to start the quiz',
    'random <rounds>': 'to start the random quiz',
    hint: 'to open the first letter',
    skip: 'to skip the round',
    end: 'to end the game',
  }
  channel.send({
    embeds: [
      {
        title: 'Commands',
        fields: [
          { name: 'Quizzes', value: sheetList.map((sheet, i) => `\`!${sheet}\`: ${sheetDescriptions[i]}`).join('\n') },
          {
            name: 'Operations',
            value: Object.entries(operationDescriptions)
              .map(([key, val]) => `\`!${key}\` ${val}`)
              .join('\n'),
          },
        ],
      },
    ],
  })
}

module.exports.onMessage = async function (message) {
  console.log(`state:${quiz.state}, completed:${quiz.completed}/${quiz.rounds}, message:${message}`)
  const channel = message.guild.channels.cache.find((ch) => ch.name === process.env.CHANNEL_NAME)
  if (!message.content.startsWith(prefix)) {
    if (quiz.state === 'playing') {
      quiz.judge(message)
    }
  } else {
    const [command, ...args] = message.content.slice(prefix.length).split(/\s+/)
    if (quiz.state === 'playing' && command === 'skip') {
      channel.send(`The answer was ${quiz.now.answers.join(', ')}.`)
      quiz.setNext()
    } else if (quiz.state === 'playing' && command === 'end') {
      quiz.halt()
    } else if (quiz.state == 'playing' && command == 'hint') {
      quiz.hint()
    } else {
      const [rounds] = [...args, 5]
      spreadsheet
        .getSheetList()
        .then(async (sheetList) => {
          const sheets = command.split(',')
          if (quiz.state == 'waiting' && sheets.every((sheet) => sheetList.includes(sheet))) {
            console.log(sheets, rounds)
            await quiz.set(channel, sheets, rounds)
            quiz.send()
          } else if (quiz.state == 'waiting' && command === 'random') {
            console.log(sheetList, rounds)
            await quiz.set(channel, sheetList, rounds)
            quiz.send()
          } else {
            sendCommandList(channel, sheetList)
          }
        })
        .catch((_) => {
          console.log(`Something went wrong to process "${message}"`)
        })
    }
  }
}

spreadsheet.init()
