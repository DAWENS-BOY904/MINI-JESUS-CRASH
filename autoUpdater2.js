// autoUpdater.js
// autoUpdater.js
import fetch from "node-fetch";
import simpleGit from "simple-git";
import { execSync, exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GITHUB_REPO = "DAWENS-BOY904/MINI-JESUS-CRASH";
const BRANCH = "main";

const git = simpleGit(__dirname);
let lastCommitSha = null;

// === Session Management ===
const SESSION_FILE = path.join(__dirname, "sessions.json");

// Create session file if not exists
if (!fs.existsSync(SESSION_FILE)) fs.writeFileSync(SESSION_FILE, "{}");

// Load sessions
function loadSessions() {
  return JSON.parse(fs.readFileSync(SESSION_FILE));
}

// Save sessions
function saveSessions(sessions) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2));
}

// Cleanup sessions older than 2 days
function cleanupSessions() {
  const sessions = loadSessions();
  const now = Date.now();
  let changed = false;
  for (const user in sessions) {
    if (now - sessions[user].timestamp > 2 * 24 * 60 * 60 * 1000) {
      delete sessions[user];
      changed = true;
    }
  }
  if (changed) saveSessions(sessions);
}

// === Anti-Spam / Anti-Ban / Anti-Report ===
const userActivity = {}; // userId -> { lastMessageTime, count }

function antiSpam(userId) {
  const now = Date.now();
  if (!userActivity[userId]) userActivity[userId] = { lastMessageTime: now, count: 1 };
  else {
    const diff = now - userActivity[userId].lastMessageTime;
    if (diff < 2000) userActivity[userId].count += 1;
    else userActivity[userId] = { lastMessageTime: now, count: 1 };

    if (userActivity[userId].count > 5) {
      console.log(`[ANTISPAM] User ${userId} is spamming!`);
      return true; // Block message
    }
  }
  return false;
}

// === Security Function: Syntax Check Before Applying Update ===
function secureUpdate(tempDir) {
  try {
    console.log("🧪 Running syntax check...");
    execSync("npm run build", { cwd: tempDir, stdio: "inherit" });
    execSync("node --check ./server.js", { cwd: tempDir });
    console.log("✅ Syntax OK — Safe to apply update");
    return true;
  } catch (err) {
    console.error("❌ Update contains errors — cancelled", err.message);
    return false;
  }
}

// === Check GitHub for new commits ===
async function checkForUpdate() {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/commits/${BRANCH}`);
    const data = await res.json();

    if (!data.sha) return;

    if (lastCommitSha && lastCommitSha !== data.sha) {
      console.log("🚀 Update available! Preparing update...");
      await updateBot();
    } else {
      console.log("✅ Bot is already up to date.");
    }

    lastCommitSha = data.sha;
  } catch (err) {
    console.error("⚠️ Failed to check GitHub:", err);
  }
}

// === Update Bot ===
async function updateBot() {
  try {
    const tempDir = path.join(__dirname, "tmp_update");
    execSync(`rm -rf ${tempDir} && mkdir ${tempDir}`);
    execSync(`git clone --depth=1 https://github.com/${GITHUB_REPO}.git ${tempDir}`);

    // Run syntax check
    if (!secureUpdate(tempDir)) {
      execSync(`rm -rf ${tempDir}`);
      return;
    }

    // Apply update
    execSync(`git reset --hard origin/${BRANCH}`, { cwd: __dirname });
    execSync(`rm -rf ${tempDir}`);

    // Cleanup sessions before restart
    cleanupSessions();

    console.log("✅ Update applied successfully! Restarting bot...");
    exec("pm2 restart bot || node index.js", (err) => {
      if (err) console.error("⚠️ Failed to restart bot:", err);
      else console.log("Bot restarted with the new version.");
    });
  } catch (err) {
    console.error("❌ Update failed:", err.message);
  }
}

// Auto check every 5 minutes
setInterval(checkForUpdate, 9 * 60 * 1000);
console.log("Auto updater running every 9 minutes...");

// Optional: force update via CLI
if (process.argv.includes("--update")) updateBot();

// === Export for bot use ===
export { antiSpam, loadSessions, saveSessions };
