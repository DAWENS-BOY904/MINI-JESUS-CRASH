import express from 'express';
import fs from 'fs-extra';
import { exec } from "child_process";
import pino from "pino";
import { Boom } from "@hapi/boom";
import crypto from 'crypto';

const router = express.Router();

const MESSAGE = process.env.MESSAGE || `
> ▬▬ι══════════════ι▬▬
    𓊈 𝐃𝐄𝐕. 𝐃𝐀𝐖𝐄𝐍𝐒 𓊉
> ▬▬ι══════════════ι▬▬

🚨🍷WELCOME BACK 📵🚨
> *❝ Se message est accordé avec votre session id ❞*
\`\`\`⌘❀══════◄••❀••►═════⌘\`\`\`
\`\`\`MINI JESUS CRASH WEB\`\`\`

*_FOLLOW SUPPORT_*

_. https://whatsapp.com/channel/0029VbBlpT396H4JPxNF7707 ._
\`\`\`⌘❀══════◄••❀••►═════⌘\`\`\`

> 𓆩〭〬⛃͢𝐃𝐒 𝐃𝐀𝐖𝐄𝐍𝐒 ⁴¹⿕ 
> 𓆩〭〬⛃͢ INCONNU BOY 𝐃𝐒 ⁴¹⿕
`;

import { upload } from './mega.js';
import {
    makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    DisconnectReason
} from "@whiskeysockets/baileys";

// Clear auth directory at startup - FORCER le nettoyage
if (fs.existsSync('./sessions')) {
    fs.emptyDirSync('./sessions');
}

router.get('/', async (req, res) => {
    let num = req.query.number;

    // Validation du numéro
    if (!num) {
        return res.status(400).json({ error: "Number is required" });
    }

    num = num.replace(/[^0-9]/g, '');
    if (num.length < 11) {
        return res.status(400).json({ error: "Invalid number format" });
    }

    // FORCER le nettoyage de session à chaque requête
    if (fs.existsSync('./sessions')) {
        await fs.emptyDir('./sessions');
    }

    async function StartSession() {
        // TOUJOURS créer un nouvel état d'auth
        const { state, saveCreds } = await useMultiFileAuthState(`./session_pair`);

        try {
            const devask = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
                // FORCER la nouvelle session
                markOnlineOnConnect: false,
                syncFullHistory: false,
                generateHighQualityLinkPreview: false
            });

            // TOUJOURS demander un nouveau code de pairing, peu importe l'état
            await delay(1000);
            
            try {
                const code = await devask.requestPairingCode(num);
                console.log(`✅ Nouveau code de pairing généré: ${code}`);
                
                if (!res.headersSent) {
                    return res.send({ code });
                }
            } catch (pairingError) {
                console.log("❌ Erreur pairing code, retrying...", pairingError);
                // Réessayer une fois
                await delay(2000);
                const code = await devask.requestPairingCode(num);
                console.log(`✅ Code de pairing après retry: ${code}`);
                
                if (!res.headersSent) {
                    return res.send({ code });
                }
            }

            devask.ev.on('creds.update', saveCreds);

            devask.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === "open") {  
                    try {
                        await delay(8000);

                        const auth_path = './sessions/';
                        const user = devask.user.id;

                        // Random Mega ID generator
                        function randomMegaId(length = 6, numberLength = 4) {
                            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                            let result = '';
                            for (let i = 0; i < length; i++) {
                                result += characters.charAt(Math.floor(Math.random() * characters.length));
                            }
                            const number = Math.floor(Math.random() * Math.pow(10, numberLength));
                            return `${result}${number}`;
                        }

                        // Upload creds.json to Mega
                        const mega_url = await upload(fs.createReadStream(auth_path + 'creds.json'), `${randomMegaId()}.json`);

                        // Extraire fileID et key en toute sécurité
                        let fileID, key;
                        if (mega_url.includes('#')) {
                            const parts = mega_url.split('/file/')[1].split('#');
                            fileID = parts[0];
                            key = parts[1];
                        } else {
                            fileID = mega_url.split('/file/')[1];
                            key = crypto.randomBytes(32).toString('base64'); // fallback
                        }

                        // Construire la session avec préfixe ASK-CRASHER-V1~
                        const sessionString = `MINI-JESUS-CRASH~${fileID}#${key}`;

                        // Envoyer la session à l'utilisateur
                        const msgsss = await devask.sendMessage(user, { text: sessionString });

                        await devask.sendMessage(user, { 
                            image: { 
                                url: "https://files.catbox.moe/x16nfd.png" 
                            }, 
                            caption: MESSAGE,
                            contextInfo: {
                                isForwarded: true,
                                mentionedJid: [user],
                                forwardedNewsletterMessageInfo: {
                                    newsletterName: "𝐃𝐀𝐖𝐄𝐍𝐒 𝐓𝐄𝐂𝐇 || 𝐎𝐅𝐅𝐂",
                                    newsletterJid: `120363406278870899@newsletter`
                                },
                            }
                        }, { quoted: msgsss });

                        await delay(1000);
                        await fs.emptyDir(auth_path);

                        // Déconnexion propre
                        await devask.logout();
                        await delay(1000);

                    } catch (e) {
                        console.log("Error during upload or send:", e);
                    }
                }

                if (connection === "close") {
                    const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                    console.log("Connection closed with reason:", reason);
                    
                    // Nettoyer après déconnexion
                    await fs.emptyDir('./sessions');
                }
            });

        } catch (err) {
            console.log("Error in StartSession function:", err);
            
            // Nettoyer et réessayer
            await fs.emptyDir('./sessions');
            
            if (!res.headersSent) {
                // Réessayer avec une nouvelle session
                try {
                    console.log("🔄 Retrying with new session...");
                    await StartSession();
                } catch (retryError) {
                    console.log("❌ Retry failed:", retryError);
                    return res.send({ code: "réessayez dans quelques secondes 🫩" });
                }
            }
        }
    }

    await StartSession();
});

export default router;
