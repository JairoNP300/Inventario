import { watch, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
dotenv.config({ path: join(ROOT, '.env') });

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'JairoNP300';
const REPO = 'Inventario';
const DEBOUNCE_MS = 2000;

const IGNORE = ['node_modules', '.git', 'dist', '.github', 'scratch', '.timestamp-', '.tmp', '.swp', 'server.log'];

let timer = null;

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com', path: `/repos/${OWNER}/${REPO}${path}`, method,
      headers: { 'User-Agent': 'node', 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { if (res.statusCode >= 400) reject(Error(`HTTP ${res.statusCode}`)); else { try { resolve(JSON.parse(data)); } catch { resolve(data); } } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function triggerWebhooks() {
  for (const { url, name } of [
    { url: process.env.VERCEL_DEPLOY_HOOK_URL, name: 'Vercel' },
    { url: process.env.RENDER_DEPLOY_HOOK_URL, name: 'Render' },
  ]) {
    if (!url) continue;
    try { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); } catch {}
  }
}

async function pushChanges() {
  if (!TOKEN) return;
  try {
    const files = ['src/App.jsx', 'server/server.js', 'server/github-db.js', 'package.json', 'package-lock.json', 'vite.config.js', 'index.html', 'vercel.json', 'deploy-github.mjs', 'deploy.bat', 'scripts/watch-deploy.js', '.github/workflows/deploy.yml', 'data/data.json', 'server/seed-data.json'];

    // Get last commit SHA
    let parentSha;
    try { const ref = await api('GET', '/git/ref/heads/main'); parentSha = ref.object.sha; } catch { parentSha = null; }

    // Get existing tree to compare
    let existingTree = {};
    if (parentSha) {
      try {
        const commit = await api('GET', `/git/commits/${parentSha}`);
        const tree = await api('GET', `/git/trees/${commit.tree.sha}?recursive=1`);
        for (const item of tree.tree) {
          if (item.type === 'blob') existingTree[item.path] = item.sha;
        }
      } catch {}
    }

    const treeEntries = [];
    let changed = 0;
    for (const f of files) {
      const fp = join(ROOT, f.replace(/\//g, '\\'));
      if (!existsSync(fp)) continue;
      const content = readFileSync(fp).toString('base64');
      const blob = await api('POST', '/git/blobs', { content, encoding: 'base64' });
      treeEntries.push({ path: f, mode: '100644', type: 'blob', sha: blob.sha });
      if (existingTree[f] !== blob.sha) changed++;
    }

    if (changed === 0) return;
    console.log(`📤 ${changed} archivo(s) → GitHub`);

    const tree = await api('POST', '/git/trees', { base_tree: parentSha || undefined, tree: treeEntries });
    const commit = await api('POST', '/git/commits', { message: `Auto-deploy: ${new Date().toLocaleString('es-SV')}`, tree: tree.sha, parents: parentSha ? [parentSha] : [], author: { name: 'JairoNP300', email: 'jairo@example.com' } });
    await api('PATCH', '/git/refs/heads/main', { sha: commit.sha, force: false });
    console.log(`  ✅ ${commit.sha.substring(0, 7)}`);
    await triggerWebhooks();
  } catch (e) {
    if (!e.message?.includes('lock')) console.error('❌', e.message.slice(0, 100));
  }
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(pushChanges, DEBOUNCE_MS);
}

function shouldIgnore(filename) {
  return !filename || IGNORE.some(i => filename.includes(i));
}

console.log(`🚀 Auto-deploy ${TOKEN ? '✅' : '⚠️ inactivo (sin GITHUB_TOKEN)'}`);
if (!TOKEN) process.exit(1);
pushChanges();
watch(ROOT, { recursive: true }, (_, filename) => { if (!shouldIgnore(filename)) schedule(); });
