import { contextInfo } from '../system/contextInfo.js';
import os from 'os';

// Small caps util
const toSmallCaps = (str) => {
  const smallCaps = {
    A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ғ', G: 'ɢ', H: 'ʜ',
    I: 'ɪ', J: 'ᴊ', K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ', P: 'ᴘ',
    Q: 'ǫ', R: 'ʀ', S: 's', T: 'ᴛ', U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x',
    Y: 'ʏ', Z: 'ᴢ'
  };
  return str.toUpperCase().split('').map(c => smallCaps[c] || c).join('');
};

// Delay helper
const wait = (ms) => new Promise(res => setTimeout(res, ms));

async function menu(devask, m, msg, args, extra) {
    const { chatType, userPrefix, userMode, isOwner, isSudo } = extra;
const from = m.chat;
const sender = m.sender;
    const pushname = m.pushName || "No Name";    
    
 // Ask for confirmation
      const promptMsg = await devask.sendMessage(from, {
        text: '⚠️ Ready to open the menu?\nReact (✅ / 👍) or reply "yes" within 30s.'
      }, { quoted: m });

      // Wait for confirmation
      const waitForConfirmation = (timeout = 30000) => new Promise((resolve) => {
        let done = false;

        const cleanup = () => {
          devask.ev.off('messages.reaction', onReaction);
          devask.ev.off('messages.upsert', onUpsert);
          clearTimeout(timer);
        };

        const onReaction = (react) => {
          const data = Array.isArray(react) ? react[0] : react;
          if (!data) return;
          const emoji = data.text || data.reaction || data.emoji;
          const matches = data.key.remoteJid === from && data.key.id === promptMsg.key.id;
          if (matches && ['✅', '👍', '❤️'].includes(emoji)) {
            cleanup();
            done = true;
            resolve(true);
          }
        };

        const onUpsert = (ev) => {
          const msgs = ev.messages || [];
          for (const msg of msgs) {
            const txt = msg.message?.conversation?.toLowerCase() || '';
            if (msg.key.remoteJid === from && msg.key.participant === sender && ['yes', 'wi', 'ok', '✅'].includes(txt)) {
              cleanup();
              done = true;
              resolve(true);
            }
          }
        };

        devask.ev.on('messages.reaction', onReaction);
        devask.ev.on('messages.upsert', onUpsert);

        const timer = setTimeout(() => {
          if (!done) {
            cleanup();
            resolve(false);
          }
        }, timeout);
      });

      const confirmed = await waitForConfirmation();
      if (!confirmed) {
        await devask.sendMessage(from, { text: '⏳ No confirmation received. Menu cancelled.' }, { quoted: promptMsg });
        return;
      }

      // Show loading animation
      const stages = [
        '⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜  0%',
        '🟩⬜⬜⬜⬜⬜⬜⬜⬜⬜  10%',
        '🟩🟩⬜⬜⬜⬜⬜⬜⬜⬜  25%',
        '🟩🟩🟩🟩⬜⬜⬜⬜⬜⬜  50%',
        '🟩🟩🟩🟩🟩🟩⬜⬜⬜⬜  75%',
        '🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩  100%'
      ];
      let loadingMsg = await devask.sendMessage(from, { text: `🖤 Loading...\n${stages[0]}` }, { quoted: promptMsg });
      for (let i = 1; i < stages.length; i++) {
        await wait(500);
        try {
          await devask.sendMessage(from, { edit: loadingMsg.key, text: `🖤 Loading...\n${stages[i]}` });
        } catch {
          loadingMsg = await devask.sendMessage(from, { text: `🖤 Loading...\n${stages[i]}` });
        }
      }
      await wait(700);
      await devask.sendMessage(from, { text: '✅ Menu ready! Displaying...' }, { quoted: loadingMsg });

    await devask.sendMessage(m.chat, { 
      react: { text: "📁", key: m.key } 
    });    
    
    let menuText = `> ➹═════════════╍═══➷
> ▬▬ι══════════════ι▬▬
   𓊈 𝐀𝐒𝐊 𝐂𝐑𝐀𝐒𝐇𝐄𝐑 𝐕.1.⁰.⁰ 𓊉
> ▬▬ι══════════════ι▬▬
> ➪ 𝐔𝐬𝐞𝐫 : *${pushname}*
> ➪ 𝐏𝐫𝐞𝐟𝐢𝐱𝐞 : *[${userPrefix}]*
> ➪ 𝐌𝐨𝐝𝐞 : *${userMode}*
> ➪ 𝐎𝐰𝐧𝐞𝐫 : *${isOwner ? '✅' : '❌'}*
> ➪ 𝐒𝐮𝐝𝐨 : *${isSudo ? '✅' : '❌'}*
> ➪ 𝐕𝐞𝐫𝐬𝐢𝐨𝐧 : 𝐆𝐫𝐚𝐭𝐮𝐢𝐭 𝐃𝐮 𝐁𝐨𝐭
> ▬▬ι══════════════ι▬▬

> ╭════╍𝐜𝐨𝐦𝐦𝐚𝐧𝐝𝐬╍═══➷
> ║ ◦ 𝚂𝙴𝚂𝚂𝙸𝙾𝙽
> ║ ◦ 𝙳𝙴𝚅
> ║ ◦ 𝙰𝙻𝙸𝚅𝙴
> ║ ◦ 𝙼𝙴𝙽𝚄
> ║ ◦ 𝙱𝚄𝙶𝙼𝙴𝙽𝚄
> ║ ◦ 𝚂𝚃𝙸𝙲𝙺𝙴𝚁
> ║ ◦ 𝚃𝙰𝙺𝙴
> ║ ◦ 𝚄𝚁𝙻
> ║ ◦ 😏 /viewonce
> ║ ◦ 𝙿𝚁𝙾𝙼𝙾𝚃𝙴
> ║ ◦ 𝙳𝙴𝙼𝙾𝚃𝙴
> ║ ◦ 𝚁𝙴𝙼𝙾𝚅𝙴
> ║ ◦ 𝙼𝙴𝙽𝚃𝙸𝙾𝙽
> ╰══════════════╍═══➹
> ▬▬ι══════════════ι▬▬
`;
  
    await devask.sendMessage(m.chat, { 
      image: { url: 'https://files.catbox.moe/frbcih.jpg' }, 
      caption: menuText,
      contextInfo: {
        ...contextInfo,
        mentionedJid: [m.sender]
      }
    }, { quoted: m });

// Play optional sound
      const sounds = [
    'https://files.catbox.moe/3cj1e3.mp4',
    'https://files.catbox.moe/vq3odo.mp4',
    'https://files.catbox.moe/fo2kz0.mp4'
  ];
  const random = sounds.at(Math.floor(Math.random() * sounds.length));
  await devask.sendMessage(from, { audio: { url: random }, mimetype: 'audio/mp4', ptt: true });
}

export default { 
  name: "menu", 
  run: menu
};