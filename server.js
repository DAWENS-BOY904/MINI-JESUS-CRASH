// ==================== server.js ====================
import { sessionGuard, loadMegaSession } from "./autoUpdater.js";
import pairRouter from './pair.js';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import dotenv from "dotenv";
import OpenAI from "openai";
import bodyParser from 'body-parser';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import session from 'cookie-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as AppleStrategy } from 'passport-apple';

// --- Config ---
dotenv.config();

// Import des fonctions depuis index.js
import { activeSessions, loadConfig, startBotForSession } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ CORRECT OpenAI initialization
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const GEMINI_KEY = "AIzaSyDOgIsixqP3R1hjn9r1Fa9zXmTPDG_A6hk"; // Kenbe kle la sou server sèlman

app.post("/api/chat", async (req, res) => {
  try {
    const { message, image } = req.body;

    // Rele API ekstèn avèk kle ou
    const apiRes = await axios.post(
      "https://gemini-api.example.com/chat", // Mete URL API ou
      { message, image },
      { headers: { Authorization: `Bearer ${GEMINI_KEY}` } }
    );

    // Voye repons API a tounen nan frontend
    res.json({ reply: apiRes.data.reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "⚠️ Error contacting AI API" });
  }
});
// ========== Middleware ==========
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.use(session({
  name: 'session',
  keys: ['secretkey1','secretkey2'],
  maxAge: 24*60*60*1000
}));

app.use(passport.initialize());
app.use(passport.session());

const __path = process.cwd();
// ==================== KEEP ALIVE SYSTEM ====================
function startKeepAlive() {
  console.log('🫀 Initialisation du système Keep-Alive...');
  
  // Ping interne toutes les 4 minutes
  const keepAliveInterval = setInterval(async () => {
    try {
      const timestamp = new Date().toISOString();
      console.log(`🫀 Keep-alive heartbeat - ${timestamp}`);
      
      // Vérifier le statut des sessions
      const connectedSessions = Array.from(activeSessions.values()).filter(s => s.connected).length;
      console.log(`📊 Sessions connectées: ${connectedSessions}/${activeSessions.size}`);
      
    } catch (error) {
      console.log('❌ Keep-alive error:', error.message);
    }
  }, 4 * 60 * 1000); // 4 minutes

  // Auto-ping externe si on est sur Render
  if (process.env.RENDER) {
    setInterval(async () => {
      try {
        const appUrl = `https://${process.env.RENDER_SERVICE_NAME}.onrender.com` || `http://localhost:${PORT}`;
        const response = await fetch(`${appUrl}/api/ping`);
        console.log(`🌐 External ping: ${response.status} - ${appUrl}`);
      } catch (error) {
        console.log('❌ External ping failed:', error.message);
      }
    }, 3 * 60 * 1000); // 3 minutes
  }

  return keepAliveInterval;
}

// ==================== Fonctions Helper ====================

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Erreur sauvegarde config:', error);
    return false;
  }
}

// Fonction pour sauvegarder dans les fichiers JSON utilisateur
function saveUserConfig(file, data) {
  try {
    const filePath = path.join(databaseDir, file);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`❌ Erreur sauvegarde ${file}:`, error);
    return false;
  }
}

// Fonction pour charger les configurations utilisateur
function loadUserConfig(file) {
  try {
    const filePath = path.join(databaseDir, file);
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Erreur lecture ${file}:`, error);
    return {};
  }
}

// Fonction pour formater le numéro en JID
function formatToJid(number) {
  const cleanNumber = number.replace(/[^\d]/g, '');
  return cleanNumber + '@s.whatsapp.net';
}

// ==================== Routes ====================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Route HTML principale - SERVIR pair.html
app.get('/index', (req, res) => {
    res.sendFile(path.join(__path, 'index.html'));
});

// ==================== API Routes pour configurations utilisateur ====================

// API pour sauvegarder owner
app.post('/api/save-owner', (req, res) => {
  try {
    const { userJid, ownerNumber } = req.body;
    const owners = loadUserConfig('owner.json');
    owners[userJid] = ownerNumber;

    if (saveUserConfig('owner.json', owners)) {
      res.json({ success: true });
    } else {
      throw new Error('Erreur sauvegarde owner');
    }
  } catch (error) {
    console.error('❌ Erreur sauvegarde owner:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API pour sauvegarder prefix
app.post('/api/save-prefix', (req, res) => {
  try {
    const { userJid, prefix } = req.body;
    const prefixes = loadUserConfig('prefix.json');
    prefixes[userJid] = prefix;

    if (saveUserConfig('prefix.json', prefixes)) {
      res.json({ success: true });
    } else {
      throw new Error('Erreur sauvegarde prefix');
    }
  } catch (error) {
    console.error('❌ Erreur sauvegarde prefix:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API pour sauvegarder mode
app.post('/api/save-mode', (req, res) => {
  try {
    const { userJid, mode } = req.body;
    const modes = loadUserConfig('mode.json');
    modes[userJid] = mode;

    if (saveUserConfig('mode.json', modes)) {
      res.json({ success: true });
    } else {
      throw new Error('Erreur sauvegarde mode');
    }
  } catch (error) {
    console.error('❌ Erreur sauvegarde mode:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API pour sauvegarder sudo
app.post('/api/save-sudo', (req, res) => {
  try {
    const { userJid, sudoNumbers } = req.body;
    const sudo = loadUserConfig('sudo.json');

    // Convertir les numéros en format JID
    sudo[userJid] = sudoNumbers.map(num => {
      const cleanNum = num.replace(/[^\d]/g, '');
      return cleanNum + '@s.whatsapp.net';
    });

    if (saveUserConfig('sudo.json', sudo)) {
      res.json({ success: true });
    } else {
      throw new Error('Erreur sauvegarde sudo');
    }
  } catch (error) {
    console.error('❌ Erreur sauvegarde sudo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== API Routes ====================

// API pour récupérer la configuration ET le statut des sessions
app.get('/api/config', (req, res) => {
    try {
        const config = loadConfig();
        
        // Ajouter le statut des sessions actives
        const sessionsWithStatus = config.sessions.map(session => {
            const activeSession = activeSessions.get(session.name);
            return {
                ...session,
                status: activeSession ? (activeSession.connected ? 'connected' : 'connecting') : 'not_started',
                hasQr: activeSession && activeSession.qrCode ? true : false,
                lastActivity: activeSession?.performance?.lastActivity || null,
                connectionTime: activeSession?.performance?.connectionTime || null,
                welcomeMessageSent: activeSession?.performance?.welcomeMessageSent || false
            };
        });

        res.json({
            ...config,
            sessions: sessionsWithStatus,
            activeSessionsCount: activeSessions.size,
            totalSessions: config.sessions.length,
            serverUptime: process.uptime(),
            lastKeepAlive: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erreur lecture config:', error);
        res.status(500).json({ 
            error: 'Erreur de lecture de la configuration'
        });
    }
});

// API PING pour keep-alive
app.get('/api/ping', (req, res) => {
    res.json({ 
        status: 'alive', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        activeSessions: activeSessions.size,
        connectedSessions: Array.from(activeSessions.values()).filter(s => s.connected).length,
        memory: process.memoryUsage(),
        environment: process.env.RENDER ? 'render' : 'local'
    });
});

// API de santé améliorée
app.get('/api/health', (req, res) => {
    try {
        const config = loadConfig();
        const activeSessionsArray = Array.from(activeSessions.values());
        
        const stats = {
            connected: activeSessionsArray.filter(s => s.connected).length,
            connecting: activeSessionsArray.filter(s => !s.connected && !s.qrCode).length,
            qrRequired: activeSessionsArray.filter(s => s.qrCode).length,
            messageSent: activeSessionsArray.filter(s => s.performance?.welcomeMessageSent).length,
            totalMessages: activeSessionsArray.reduce((sum, s) => sum + (s.performance?.messageCount || 0), 0)
        };

        res.json({
            status: 'OK',
            message: 'ASK CRASHER Server Running',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            keepAlive: 'active',
            sessions: {
                active: activeSessions.size,
                total: config.sessions.length,
                stats: stats
            },
            memory: process.memoryUsage(),
            nodeVersion: process.version,
            environment: process.env.RENDER ? 'render' : 'local'
        });
    } catch (error) {
        console.error('❌ Erreur health check:', error);
        res.status(500).json({ 
            status: 'ERROR',
            error: 'Erreur lors du health check'
        });
    }
});

// API pour sauvegarder la configuration ET démarrer les sessions
app.post('/api/config', async (req, res) => {
    try {
        const newConfig = req.body;

        // Validation basique
        if (!newConfig || typeof newConfig !== 'object') {
            return res.status(400).json({ error: 'Configuration invalide' });
        }

        // S'assurer que sessions est un tableau
        if (!Array.isArray(newConfig.sessions)) {
            newConfig.sessions = [];
        }

        // Charger l'ancienne config pour comparer
        const oldConfig = loadConfig();
        const oldSessions = oldConfig.sessions || [];

        // Trouver les nouvelles sessions
        const newSessions = newConfig.sessions.filter(newSession => 
            !oldSessions.some(oldSession => oldSession.name === newSession.name)
        );

        // Sauvegarder la configuration
        const success = saveConfig(newConfig);

        if (success) {
            console.log('✅ Configuration MINI JESUS CRASH sauvegardée');
            
            // DÉMARRER LES NOUVELLES SESSIONS
            let startedCount = 0;
            let failedCount = 0;
            
            if (newSessions.length > 0) {
                console.log(`🎯 Détection de ${newSessions.length} nouvelle(s) session(s) à démarrer:`);
                
                for (const session of newSessions) {
                    console.log(`   ➕ Démarrage de: ${session.name} (${session.ownerNumber})`);
                    try {
                        await startBotForSession(session);
                        startedCount++;
                        console.log(`   ✅ Session ${session.name} démarrée avec succès`);
                    } catch (error) {
                        console.error(`   ❌ Erreur démarrage session ${session.name}:`, error.message);
                        failedCount++;
                    }
                }
            }

            res.json({ 
                success: true, 
                message: 'Configuration sauvegardée avec succès!',
                sessionsCount: newConfig.sessions.length,
                newSessionsStarted: startedCount,
                newSessionsFailed: failedCount,
                activeSessions: Array.from(activeSessions.keys()),
                keepAlive: 'active'
            });
        } else {
            throw new Error('Échec de la sauvegarde');
        }
    } catch (error) {
        console.error('❌ Erreur sauvegarde config:', error);
        res.status(500).json({ 
            error: 'Erreur lors du déploiement: ' + error.message
        });
    }
});

// ==================== API POUR LA SURVEILLANCE ====================

// API pour vérifier le statut d'une session
app.get('/api/session/:sessionName/status', (req, res) => {
    try {
        const { sessionName } = req.params;
        const session = activeSessions.get(sessionName);

        if (!session) {
            return res.json({
                exists: false,
                status: 'not_started',
                connected: false,
                hasQr: false,
                message: 'Session non démarrée ou non trouvée'
            });
        }

        res.json({
            exists: true,
            status: session.connected ? 'connected' : 'connecting',
            connected: session.connected,
            hasQr: !!session.qrCode,
            performance: session.performance,
            config: session.config,
            lastDisconnectTime: session.lastDisconnectTime,
            message: session.connected ? 
                '✅ Bot connecté et opérationnel' : 
                session.qrCode ? 
                    '📷 QR Code requis - Vérifiez la console' : 
                    '🔄 Connexion en cours...'
        });
    } catch (error) {
        console.error('❌ Erreur statut session:', error);
        res.status(500).json({ 
            error: 'Erreur serveur lors de la vérification du statut'
        });
    }
});

// API pour vérifier si MegaJS a réussi à charger la session
app.get('/api/session/:sessionName/mega-status', (req, res) => {
    try {
        const { sessionName } = req.params;
        const config = loadConfig();
        const sessionConfig = config.sessions.find(s => s.name === sessionName);

        if (!sessionConfig) {
            return res.status(404).json({ 
                error: 'Session non trouvée dans la configuration',
                sessionName,
                existsInConfig: false
            });
        }

        const sessionUserDir = path.join(__dirname, 'sessions', sessionName);
        const credsPath = path.join(sessionUserDir, 'creds.json');
        
        const megaLoaded = fs.existsSync(credsPath);
        const sessionDirExists = fs.existsSync(sessionUserDir);
        
        res.json({
            sessionName,
            existsInConfig: true,
            megaLoaded,
            hasLocalSession: megaLoaded,
            sessionDirExists,
            sessionPath: sessionUserDir,
            message: megaLoaded ? 
                '✅ Session Mega chargée avec succès' : 
                '🔄 Session Mega non encore chargée'
        });
    } catch (error) {
        console.error('❌ Erreur vérification Mega:', error);
        res.status(500).json({ 
            error: 'Erreur serveur lors de la vérification Mega'
        });
    }
});

// API pour surveiller la connexion complète
app.get('/api/session/:sessionName/connection-status', async (req, res) => {
    try {
        const { sessionName } = req.params;
        const session = activeSessions.get(sessionName);

        if (!session) {
            return res.json({
                status: 'not_started',
                connected: false,
                messageSent: false,
                progress: 'session_not_started',
                details: 'La session n\'a pas été démarrée par le système'
            });
        }

        // Vérifier si le message de bienvenue a été envoyé
        const messageSent = session.performance?.welcomeMessageSent || false;
        
        let progress = 'connecting';
        let message = '🔄 Connexion en cours...';

        if (session.connected) {
            if (messageSent) {
                progress = 'completed';
                message = '✅ Bot connecté et message envoyé!';
            } else {
                progress = 'connected_no_message';
                message = '✅ Bot connecté - Envoi du message en cours...';
            }
        } else if (session.qrCode) {
            progress = 'qr_required';
            message = '📷 QR Code requis - Scannez le code dans la console';
        }

        res.json({
            status: session.connected ? 'connected' : 'connecting',
            connected: session.connected,
            hasQr: !!session.qrCode,
            messageSent: messageSent,
            progress: progress,
            message: message,
            performance: session.performance,
            lastActivity: session.performance?.lastActivity,
            connectionTime: session.performance?.connectionTime
        });

    } catch (error) {
        console.error('❌ Erreur statut connexion:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la vérification de la connexion'
        });
    }
});

// API pour voir les sessions actives avec détails
app.get('/api/sessions/active', (req, res) => {
    try {
        const sessions = Array.from(activeSessions.entries()).map(([name, session]) => ({
            name,
            connected: session.connected,
            hasQr: !!session.qrCode,
            ownerNumber: session.config?.ownerNumber,
            performance: session.performance,
            lastDisconnectTime: session.lastDisconnectTime,
            config: session.config,
            status: session.connected ? 'connected' : 
                   session.qrCode ? 'qr_required' : 'connecting',
            welcomeMessageSent: session.performance?.welcomeMessageSent || false
        }));

        res.json({
            total: activeSessions.size,
            sessions: sessions,
            stats: {
                connected: sessions.filter(s => s.connected).length,
                connecting: sessions.filter(s => !s.connected && !s.hasQr).length,
                qrRequired: sessions.filter(s => s.hasQr).length,
                messageSent: sessions.filter(s => s.welcomeMessageSent).length
            },
            serverUptime: process.uptime(),
            lastUpdate: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erreur récupération sessions:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// API pour forcer le démarrage d'une session spécifique
app.post('/api/sessions/start', async (req, res) => {
    try {
        const { sessionName } = req.body;
        
        if (!sessionName) {
            return res.status(400).json({ error: 'Nom de session requis' });
        }

        const config = loadConfig();
        const session = config.sessions.find(s => s.name === sessionName);
        
        if (!session) {
            return res.status(404).json({ error: 'Session non trouvée dans la config' });
        }

        // Vérifier si la session est déjà active
        if (activeSessions.has(sessionName)) {
            const activeSession = activeSessions.get(sessionName);
            return res.json({ 
                success: true, 
                message: 'Session déjà active',
                sessionName: sessionName,
                connected: activeSession.connected,
                status: activeSession.connected ? 'connected' : 'connecting'
            });
        }

        // Démarrer la session
        await startBotForSession(session);
        
        res.json({ 
            success: true, 
            message: 'Session démarrée avec succès',
            sessionName: sessionName,
            status: 'starting'
        });

    } catch (error) {
        console.error('❌ Erreur démarrage session:', error);
        res.status(500).json({ 
            error: 'Erreur lors du démarrage: ' + error.message
        });
    }
});

// API pour obtenir les logs d'une session spécifique
app.get('/api/session/:sessionName/logs', (req, res) => {
    try {
        const { sessionName } = req.params;
        const session = activeSessions.get(sessionName);

        if (!session) {
            return res.status(404).json({ 
                error: 'Session non trouvée ou non active',
                sessionName
            });
        }

        res.json({
            sessionName,
            performance: session.performance,
            config: session.config,
            connectionInfo: {
                connected: session.connected,
                hasQr: !!session.qrCode,
                lastDisconnectTime: session.lastDisconnectTime,
                welcomeMessageSent: session.performance?.welcomeMessageSent || false,
                uptime: session.connected && session.performance.connectionTime ? 
                    Date.now() - session.performance.connectionTime : 0
            }
        });
    } catch (error) {
        console.error('❌ Erreur récupération logs:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// API pour les statistiques globales
app.get('/api/stats', (req, res) => {
    try {
        const config = loadConfig();
        const activeSessionsArray = Array.from(activeSessions.values());
        
        const stats = {
            global: {
                totalSessions: config.sessions.length,
                activeSessions: activeSessions.size,
                uptime: process.uptime(),
                serverStartTime: new Date(Date.now() - process.uptime() * 1000).toISOString(),
                keepAlive: 'active'
            },
            sessions: {
                connected: activeSessionsArray.filter(s => s.connected).length,
                connecting: activeSessionsArray.filter(s => !s.connected && !s.qrCode).length,
                qrRequired: activeSessionsArray.filter(s => s.qrCode).length,
                messageSent: activeSessionsArray.filter(s => s.performance?.welcomeMessageSent).length,
                disconnected: config.sessions.length - activeSessions.size
            },
            performance: {
                totalMessages: activeSessionsArray.reduce((sum, s) => sum + (s.performance?.messageCount || 0), 0),
                averageUptime: activeSessionsArray.filter(s => s.connected && s.performance.connectionTime)
                    .reduce((avg, s, i, arr) => {
                        const uptime = Date.now() - s.performance.connectionTime;
                        return (avg * i + uptime) / (i + 1);
                    }, 0)
            }
        };

        res.json(stats);
    } catch (error) {
        console.error('❌ Erreur statistiques:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route 404 améliorée
app.use((req, res) => {
    res.status(404).json({
        error: 'Page non trouvée',
        message: 'Utilisez / pour déployer une session MINI JESUS CRASG',
        availableEndpoints: [
            'GET  / - Page de déploiement',
            'GET  /pair - Page de pairing WhatsApp',
            'GET  /api/config - Configuration',
            'GET  /api/ping - Keep-alive',
            'GET  /api/health - Santé du serveur',
            'POST /api/config - Sauvegarder configuration',
            'POST /api/save-owner - Sauvegarder owner',
            'POST /api/save-prefix - Sauvegarder prefix',
            'POST /api/save-mode - Sauvegarder mode',
            'POST /api/save-sudo - Sauvegarder sudo',
            'GET  /api/session/:name/status - Statut session',
            'GET  /api/session/:name/mega-status - Statut Mega',
            'GET  /api/session/:name/connection-status - Statut connexion complète',
            'GET  /api/sessions/active - Sessions actives',
            'GET  /api/stats - Statistiques'
        ]
    });
});

// Gestionnaire d'erreurs global
app.use((error, req, res, next) => {
    console.error('❌ Erreur non gérée:', error);
    res.status(500).json({
        error: 'Erreur interne du serveur',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
});
    console.log(`=========================================`);
    console.log(`🚀 Déploiement: http://localhost:${PORT}`);
   console.log(`📱 Pairing WhatsApp: http://localhost:${PORT}/pair`);
    console.log(`🔧 API Config: http://localhost:${PORT}/api/config`);
    console.log(`📊 Sessions: http://localhost:${PORT}/api/sessions/active`);
    console.log(`❤️  Health: http://localhost:${PORT}/api/health`);
    console.log(`🤖 API Pairing: http://localhost:${PORT}/api/pair`);
    console.log(`👤 Multi-utilisateur: Système activé`);
    console.log(`🫀 Keep-alive: http://localhost:${PORT}/api/ping`);
    console.log(`📈 Stats: http://localhost:${PORT}/api/stats`);
    console.log(`=========================================\n`);


// Database setup
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) return console.error(err.message);
  console.log('Connected to SQLite database.');
});

// Create tables if not exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    number TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL,
    sender TEXT NOT NULL,
    text TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(thread_id) REFERENCES threads(id)
  )`);
});

// ========== Passport ==========
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  db.get("SELECT * FROM users WHERE id=?",[id], (err,row) => done(err,row));
});

// ========== OAuth Strategies ==========

// Google
passport.use(new GoogleStrategy({
  clientID: '665023332883-4irp48b1k5iaanle66vpjnsm2j6c40v1.apps.googleusercontent.com',
  clientSecret: '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',
  callbackURL: "/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value;
  const name = profile.displayName;
  const avatar = profile.photos[0]?.value || "https://files.catbox.moe/x16nfd.png";
  db.get("SELECT * FROM users WHERE email=?",[email], (err,row) => {
    if(err) return done(err);
    if(row) return done(null,row);
    db.run("INSERT INTO users(name,email,avatar) VALUES(?,?,?)",[name,email,avatar], function(err){
      if(err) return done(err);
      db.get("SELECT * FROM users WHERE id=?",[this.lastID], (err,row)=> done(err,row));
    });
  });
}));

// GitHub
passport.use(new GitHubStrategy({
  clientID: 'Ov23liG3zlY8q9fINd5w',
  clientSecret: '498ab7d047cfc6052d4b729417128f9bec88a895',
  callbackURL: "/auth/github/callback"
}, (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value;
  const name = profile.username;
  const avatar = profile.photos[0]?.value || "https://files.catbox.moe/x16nfd.png";
  db.get("SELECT * FROM users WHERE email=?",[email], (err,row) => {
    if(err) return done(err);
    if(row) return done(null,row);
    db.run("INSERT INTO users(name,email,avatar) VALUES(?,?,?)",[name,email,avatar], function(err){
      if(err) return done(err);
      db.get("SELECT * FROM users WHERE id=?",[this.lastID], (err,row)=> done(err,row));
    });
  });
}));

// Facebook
passport.use(new FacebookStrategy({
  clientID: 'FACEBOOK_APP_ID',
  clientSecret: 'FACEBOOK_APP_SECRET',
  callbackURL: "/auth/facebook/callback",
  profileFields: ['id','emails','name','photos']
}, (accessToken, refreshToken, profile, done) => {
  const email = profile.emails?.[0]?.value || `${profile.id}@facebook.com`;
  const name = `${profile.name.givenName} ${profile.name.familyName}`;
  const avatar = profile.photos?.[0]?.value || "https://files.catbox.moe/x16nfd.png";
  db.get("SELECT * FROM users WHERE email=?",[email], (err,row) => {
    if(err) return done(err);
    if(row) return done(null,row);
    db.run("INSERT INTO users(name,email,avatar) VALUES(?,?,?)",[name,email,avatar], function(err){
      if(err) return done(err);
      db.get("SELECT * FROM users WHERE id=?",[this.lastID], (err,row)=> done(err,row));
    });
  });
}));

// Apple
passport.use(new AppleStrategy({
  clientID: 'APPLE_CLIENT_ID',
  teamID: 'APPLE_TEAM_ID',
  keyID: 'APPLE_KEY_ID',
  privateKeyLocation: 'AuthKey.p8',
  callbackURL: "/auth/apple/callback"
}, (accessToken, refreshToken, idToken, profile, done)=>{
  const email = profile.email;
  const name = profile.name || 'Apple User';
  const avatar = "https://files.catbox.moe/x16nfd.png";
  db.get("SELECT * FROM users WHERE email=?",[email], (err,row) => {
    if(err) return done(err);
    if(row) return done(null,row);
    db.run("INSERT INTO users(name,email,avatar) VALUES(?,?,?)",[name,email,avatar], function(err){
      if(err) return done(err);
      db.get("SELECT * FROM users WHERE id=?",[this.lastID], (err,row)=> done(err,row));
    });
  });
}));

// ========== Routes ==========

// Signup
app.post('/signup', async (req,res)=>{
  const { name,email,password } = req.body;
  if(!email || !password || !name) return res.status(400).send('Missing fields');
  const hashed = await bcrypt.hash(password,10);
  const avatar = "https://files.catbox.moe/x16nfd.png";
  db.run("INSERT INTO users(name,email,password,avatar) VALUES(?,?,?,?)",[name,email,hashed,avatar], function(err){
    if(err) return res.status(400).send('Email already exists');
    req.session.userId = this.lastID;
    res.redirect('/index.html');
  });
});

// Login
app.post('/login', async (req,res)=>{
  const { email,password } = req.body;
  db.get("SELECT * FROM users WHERE email=?",[email], async (err,row)=>{
    if(err || !row) return res.status(400).send('Invalid email or password');
    const match = await bcrypt.compare(password,row.password);
    if(!match) return res.status(400).send('Invalid email or password');
    req.session.userId = row.id;
    res.redirect('/index.html');
  });
});

// Logout
app.get('/logout',(req,res)=>{
  req.session=null;
  req.logout(()=>{});
  res.redirect('/login.html');
});

// ========== OAuth Routes ==========

// Google
app.get('/auth/google', passport.authenticate('google',{scope:['profile','email']}));
app.get('/auth/google/callback', passport.authenticate('google',{failureRedirect:'/login.html'}),(req,res)=>{
  req.session.userId=req.user.id;
  res.redirect('/index.html');
});

// GitHub
app.get('/auth/github', passport.authenticate('github',{scope:['user:email']}));
app.get('/auth/github/callback', passport.authenticate('github',{failureRedirect:'/login.html'}),(req,res)=>{
  req.session.userId=req.user.id;
  res.redirect('/index.html');
});

// Facebook
app.get('/auth/facebook', passport.authenticate('facebook',{scope:['email']}));
app.get('/auth/facebook/callback', passport.authenticate('facebook',{failureRedirect:'/login.html'}),(req,res)=>{
  req.session.userId=req.user.id;
  res.redirect('/index.html');
});

// Apple
app.get('/auth/apple', passport.authenticate('apple'));
app.post('/auth/apple/callback', passport.authenticate('apple',{failureRedirect:'/login.html'}),(req,res)=>{
  req.session.userId=req.user.id;
  res.redirect('/index.html');

// Admin login
const ADMIN_EMAIL = 'admin305@gmail.com';
const ADMIN_PASS = '2026';

// Routes

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// Send message (user)
app.post('/api/message', (req,res)=>{
  const { name, number, code, message } = req.body;
  if(!name || !number || !code || !message) return res.status(400).json({error:'Missing fields'});
  db.get(`SELECT id FROM threads WHERE code=? AND number=?`, [code,number], (err,row)=>{
    if(err) return res.status(500).json({error:err.message});
    if(row){ // existing thread
      const thread_id = row.id;
      db.run(`INSERT INTO messages(thread_id,sender,text) VALUES(?,?,?)`, [thread_id,'user',message], function(err){
        if(err) return res.status(500).json({error:err.message});
        res.json({success:true});
      });
    } else {
      db.run(`INSERT INTO threads(code,name,number) VALUES(?,?,?)`, [code,name,number], function(err){
        if(err) return res.status(500).json({error:err.message});
        const thread_id = this.lastID;
        db.run(`INSERT INTO messages(thread_id,sender,text) VALUES(?,?,?)`, [thread_id,'user',message], function(err){
          if(err) return res.status(500).json({error:err.message});
          res.json({success:true});
        });
      });
    }
  });
});

// Admin get all threads
app.get('/api/admin/threads', (req,res)=>{
  db.all(`SELECT * FROM threads ORDER BY id DESC`, [], (err,threads)=>{
    if(err) return res.status(500).json({error:err.message});
    res.json(threads);
  });
});

// Admin get messages of a thread
app.get('/api/admin/thread/:id', (req,res)=>{
  const thread_id = req.params.id;
  db.all(`SELECT * FROM messages WHERE thread_id=? ORDER BY id ASC`, [thread_id], (err,msgs)=>{
    if(err) return res.status(500).json({error:err.message});
    res.json(msgs);
  });
});

// Admin send reply
app.post('/api/admin/thread/:id/reply', (req,res)=>{
  const thread_id = req.params.id;
  const { text } = req.body;
  if(!text) return res.status(400).json({error:'No text'});
  db.run(`INSERT INTO messages(thread_id,sender,text) VALUES(?,?,?)`, [thread_id,'admin',text], function(err){
    if(err) return res.status(500).json({error:err.message});
    res.json({success:true});
  });
});

// User fetch thread messages by code + number
app.post('/api/thread', (req,res)=>{
  const { code, number } = req.body;
  db.get(`SELECT id,name,number,code FROM threads WHERE code=? AND number=?`, [code,number], (err,row)=>{
    if(err) return res.status(500).json({error:err.message});
    if(!row) return res.json({messages:[]});
    const thread_id = row.id;
    db.all(`SELECT sender,text,timestamp FROM messages WHERE thread_id=? ORDER BY id ASC`, [thread_id], (err,msgs)=>{
      if(err) return res.status(500).json({error:err.message});
      res.json({thread:row,messages:msgs});
    });
  });
})

app.post("/api/ai", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.json({ ok: false, error: "No prompt provided" });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    const data = await response.json();

    if (data.choices && data.choices.length > 0) {
      return res.json({ ok: true, response: data.choices[0].message.content });
    } else {
      return res.json({ ok: false, error: "No response from OpenAI" });
    }
  } catch (err) {
    console.error(err);
    res.json({ ok: false, error: err.message });
  }
})
// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`\n🔥 MINI JESUS Server Started!`);
    startKeepAlive();
});

export default app;