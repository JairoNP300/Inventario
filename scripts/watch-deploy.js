import { watch, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../');
dotenv.config({ path: join(ROOT, '.env') });

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'JairoNP300';
const REPO = 'Inventario';
const DEBOUNCE_MS = 5000;

const IGNORE = [
  'node_modules', '.git', 'dist', '.github', 'scratch',
  '.timestamp-', '.tmp', '.swp'
];

let timer = null;
let pendingChanges = false;

function gh(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}${path}`,
      method,
      headers: {
        'User-Agent': 'node',
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
        } else {
          try { resolve(JSON.parse(data)); } catch { resolve(data); }
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function uploadFile(relativePath) {
  const filePath = join(ROOT, relativePath);
  if (!existsSync(filePath)) return;
  let sha = null;
  try {
    const existing = await gh('GET', `/contents/${relativePath}`);
    sha = existing.sha;
  } catch (e) {}
  const content64 = readFileSync(filePath).toString('base64');
  await gh('PUT', `/contents/${relativePath}`, {
    message: `Auto-sync: ${relativePath}`,
    content: content64,
    sha: sha || undefined,
  });
  console.log(`  ✅ ${relativePath}`);
}

async function deploy() {
  if (!TOKEN) {
    console.log('⚠️ GITHUB_TOKEN no configurado. Auto-deploy desactivado.');
    return;
  }
  try {
    const files = ['src/App.jsx', 'server/server.js', 'server/github-db.js', 'package.json', 'vite.config.js', 'index.html'];
    for (const f of files) {
      if (existsSync(join(ROOT, f))) {
        await uploadFile(f);
      }
    }
    console.log(`✅ Auto-deploy completo: ${new Date().toLocaleString('es-MX')}`);
  } catch (e) {
    console.error('❌ Auto-deploy error:', e.message);
  }
}

function scheduleDeployment() {
  pendingChanges = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    if (pendingChanges) {
      pendingChanges = false;
      await deploy();
    }
  }, DEBOUNCE_MS);
}

function shouldIgnore(filename) {
  if (!filename) return true;
  return IGNORE.some(ig => filename.includes(ig));
}

console.log('🚀 Auto-deploy iniciado (sin git)');
console.log('👀 Vigilando cambios...');
console.log(TOKEN ? '✅ GITHUB_TOKEN configurado' : '⚠️ Sin GITHUB_TOKEN - auto-deploy inactivo');

deploy();

watch(ROOT, { recursive: true }, (event, filename) => {
  if (filename && !shouldIgnore(filename)) {
    scheduleDeployment();
  }
});
