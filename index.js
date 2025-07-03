// index.js
import { create } from 'venom-bot';
import { google } from 'googleapis';
import dayjs from 'dayjs';
import { readFileSync } from 'fs';

// 1. Load Google credentials

const CREDENTIALS = JSON.parse(readFileSync('credentials.json', 'utf-8'));

const auth = new google.auth.JWT({
  email: CREDENTIALS.client_email,
  key: CREDENTIALS.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

await auth.authorize();
const sheets = google.sheets({ version: 'v4', auth });

// 2. Your Sheet details
const SPREADSHEET_ID = '1r7F24NZEZLpmWE78MYvmmbuWIswWpFB3utz1hWcb92A'; // <- Use your actual spreadsheet ID
const SHEET_NAME = 'Fb/Insta/LinkedIn/Whatsapp Leads'; // <- Make sure this matches the sheet tab exactly

// 3. Helper to append a row
async function appendLead(timestamp, phone, name) {
  const resource = {
    values: [[timestamp, phone, name || '']],
  };

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A:C`, // ✅ single quotes needed due to special chars in name
    valueInputOption: 'RAW',
    resource,
  });

  console.log(`✅ Appended to sheet: ${timestamp}, ${phone}, ${name}`);
}

// 4. Launch Venom bot and listen for messages
create({
  session: 'session-leads',
  headless: false, // set to true if you want to run it in the background
})
  .then(client => {
    console.log('✅ WhatsApp client ready');

    client.onMessage(async msg => {
      if (
        msg.isGroupMsg === false &&
        msg.type === 'chat' &&
        // msg.body.trim().toLowerCase() === 'interested'
        msg.body.trim() === 'Hello! Can I get more info on this?'
      ) {
        const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
        const phone = msg.from.replace('@c.us', '');
        const name = msg._data?.notifyName || ''; // ✅ Prevents crash if undefined

        try {
          await appendLead(timestamp, phone, name);
        } catch (err) {
          console.error('❌ Error appending to sheet:', err);
        }
      }
    });
  })
  .catch(err => {
    console.error('❌ Venom error:', err);
  });
