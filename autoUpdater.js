// ==================== autoUpdater.js ====================
// ✅ ESM Compatible
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { File } from "megajs"; // ✅ Added for MEGA session support

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📦 REPO CONFIG
const repoUrl = "https://github.com/DAWENS-BOY904/MINI-JESUS-CRASH.git"; // 🔁 Replace with your GitHub repo if needed
const checkInterval = 5 * 60 * 1000; // 5 min
const projectDir = __dirname;

// ==================== 🧩 GIT UTILITIES ====================

// ✅ Initialize repo if missing
function ensureGitRepo() {
  if (!fs.existsSync(path.join(projectDir, ".git"))) {
    console.log("🧩 Initialisation du dépôt local...");
    try {
      execSync(`git init && git remote add origin ${repoUrl}`, { cwd: projectDir });
    } catch (err) {
      console.warn("⚠️ Impossible d'initialiser le dépôt Git:", err.message);
    }
  }
}

// ✅ Get commit hash safely
function safeGitRevParse(ref) {
  try {
    return execSync(`git rev-parse ${ref}`, { cwd: projectDir }).toString().trim();
  } catch {
    return null;
  }
}

// ✅ Check for updates
async function checkForUpdates() {
  try {
    console.log("🔎 Checking for updates from GitHub...");

    ensureGitRepo();
    execSync("git fetch origin main", { cwd: projectDir });

    const localCommit = safeGitRevParse("HEAD");
    const remoteCommit = safeGitRevParse("origin/main");

    if (!localCommit || !remoteCommit) {
      console.warn("⚠️ Unable to determine commit hashes. Skipping update check.");
      return;
    }

    if (localCommit === remoteCommit) {
      console.log("✅ Already up to date.");
      return;
    }

    console.log("🚀 Update available! Preparing update...");

    const tempDir = path.join(projectDir, "tmp_update");
    execSync(`rm -rf ${tempDir} && mkdir ${tempDir}`);
    execSync(`git clone --depth=1 ${repoUrl} ${tempDir}`);

    console.log("🧪 Running syntax check...");
    try {
      execSync("npm run build", { cwd: tempDir, stdio: "inherit" });
      execSync("node --check ./server.js", { cwd: tempDir });
      console.log("✅ Syntax OK — Applying update...");
    } catch (err) {
      console.error("❌ Update contains errors — cancelled.");
      execSync(`rm -rf ${tempDir}`);
      return;
    }

    execSync("git reset --hard origin/main", { cwd: projectDir, stdio: "inherit" });
    execSync(`rm -rf ${tempDir}`);

    console.log("✅ Update applied successfully! Restarting server...");
    process.exit(0);
  } catch (err) {
    console.error("❌ Update check failed:", err.message);
  }
}

// ==================== ☁️ MEGA SESSION SUPPORT ====================

// ✅ Download session file from MEGA
export async function loadMegaSession(url, outputFile = "session.json") {
  console.log("🔄 Tentative de téléchargement Mega...");

  try {
    if (!url.startsWith("https://mega.nz/")) {
      throw new Error("Invalid MEGA URL");
    }

    const file = File.fromURL(url);
    await file.loadAttributes();

    const buffer = await file.downloadBuffer();
    const filePath = path.join(projectDir, outputFile);

    fs.writeFileSync(filePath, buffer);
    console.log(`✅ Session téléchargée et sauvegardée: ${filePath}`);

    return filePath;
  } catch (err) {
    console.error("❌ Impossible de charger la session depuis MEGA:", err.message);
    return null;
  }
}

// ==================== 🛡️ SESSION GUARD ====================

export function sessionGuard(mode = "default") {
  console.log(`🛡️ sessionGuard(${mode}) started`);
  ensureGitRepo();
  checkForUpdates();
  setInterval(checkForUpdates, checkInterval);
}

// ==================== 🧠 AUTO START (optional) ====================

if (import.meta.url === `file://${process.argv[1]}`) {
  sessionGuard("auto");
}