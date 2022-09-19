const dotenv = require('dotenv')
const fs = require('fs')
const readline = require('readline')
const { google } = require('googleapis')

dotenv.config()
let oAuth2Client = null
const sheets = google.sheets({ version: 'v4' })

module.exports.init = async function () {
  let credentialContent = fs.readFileSync('credentials.json')
  let credentials = JSON.parse(credentialContent)
  oAuth2Client = new google.auth.OAuth2(
    credentials.web.client_id,
    credentials.web.client_secret,
    credentials.web.redirect_uris[0]
  )

  if (!fs.existsSync(process.env.GOOGLE_TOKEN_PATH)) {
    await getNewToken()
  }

  let tokenContent = fs.readFileSync(process.env.GOOGLE_TOKEN_PATH)
  let token = JSON.parse(tokenContent)

  oAuth2Client.setCredentials(token)
}

async function getNewToken() {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  console.log('Open this link to authorize the app: ', authUrl)
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise(function (_, _) {
    rl.question('Enter the code displayed after authorization: ', async (code) => {
      rl.close()
      let { tokens } = await oAuth2Client.getToken(code)
      fs.writeFileSync(process.env.GOOGLE_TOKEN_PATH, JSON.stringify(tokens))
      console.log('Token saved to a file ', process.env.GOOGLE_TOKEN_PATH)
    })
  })
}

module.exports.getSheetData = async function (sheet) {
  let response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: sheet,
    auth: oAuth2Client,
  })

  return response.data.values
}

module.exports.getSheetList = async function () {
  let response = await sheets.spreadsheets.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    ranges: [],
    auth: oAuth2Client,
  })

  return response.data.sheets.map((sheet) => sheet.properties.title)
}
