import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} from '@whiskeysockets/baileys';
import P from 'pino';
import qrcode from 'qrcode-terminal';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
import fs from 'fs';
import { google } from 'googleapis';
dotenv.config();
// ─── Google Sheets Setup ─────────────────────────────────────────────────────
let CREDENTIALS;
if (fs.existsSync('./credentials.json')) {
  CREDENTIALS = JSON.parse(fs.readFileSync('credentials.json', 'utf-8'));
} else {
  CREDENTIALS = JSON.parse(
    Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf-8')
  );
}
const auth = new google.auth.JWT({
  email: CREDENTIALS.client_email,
  key: CREDENTIALS.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
await auth.authorize();
const sheets = google.sheets({ version: 'v4', auth });

const SPREADSHEET_ID = '1r7F24NZEZLpmWE78MYvmmbuWIswWpFB3utz1hWcb92A';
const SHEET_NAME     = 'Fb/Insta/LinkedIn/Whatsapp Leads';

async function appendLead(timestamp, phone, name) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A:C`,
    valueInputOption: 'RAW',
    resource: { values: [[timestamp, phone, name || '']] }
  });
  console.log(`✅ Appended: ${timestamp}, ${phone}, ${name}`);
}

// ─── WhatsApp (Baileys) Setup ─────────────────────────────────────────────────
async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info.json');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: 'silent' })
  });

  // Print QR manually
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
  if (qr) {
    console.log('\n📱 Scan this QR code:\n');
    qrcode.generate(qr, { small: true });
  }
  if (connection === 'open') {
    console.log('✅ WhatsApp connected');
  }
  if (connection === 'close') {
    // remove TypeScript cast — use optional chaining only
    const code = lastDisconnect?.error?.output?.statusCode;
    if (code === DisconnectReason.loggedOut) {
      console.log('❌ Logged out – delete auth_info.json and re-run');
    } else {
      console.log('🔁 Reconnecting...');
      startSock();
    }
  }
});


  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const body   = msg.message.conversation || msg.message.extendedTextMessage?.text;
    const sender = msg.key.remoteJid.replace('@s.whatsapp.net','');
    const name   = msg.pushName || '';

    if (body?.trim() === 'Hello! Can I get more info on this?') {
      const ts = dayjs().format('YYYY-MM-DD HH:mm:ss');
      try {
        await appendLead(ts, sender, name);
      } catch (err) {
        console.error('❌ Google Sheets error:', err);
      }
    }
  });
}

startSock();
