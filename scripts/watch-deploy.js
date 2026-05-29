import { watch, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
dotenv.config({ path: join(ROOT, '.env') });

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'JairoNP300';
const REPO = 'Inventario';
const DEBOUNCE_MS = 2000;

const IGNORE = [
  'node_modules', '.git', 'dist', '.github', 'scratch',
  '.timestamp-', '.tmp', '.swp', 'server.log',
];

let timer = null;

async function triggerWebhooks() {
  const hooks = [
    { url: process.env.VERCEL_DEPLOY_HOOK_URL, name: 'Vercel' },
    { url: process.env.RENDER_DEPLOY_HOOK_URL, name: 'Render' },
  ];
  for (const { url, name } of hooks) {
    if (!url) continue;
    try {
      const res = await fetch(url, { method: 'POST' });
      console.log(`  🔄 ${name}: ✅ (${res.status})`);
    } catch (e) {
      console.log(`  ⚠️ ${name}: ${e.message}`);
    }
  }
}

async function pushChanges() {
  if (!TOKEN) return;
  const auth = () => ({ username: TOKEN, password: 'x-oauth-basic' });
  try {
    if (!existsSync(join(ROOT, '.git'))) {
      await git.init({ fs, dir: ROOT, defaultBranch: 'main' });
      const remotes = await git.listRemotes({ fs, dir: ROOT });
      if (!remotes.some(r => r.remote === 'origin')) {
        await git.addRemote({ fs, dir: ROOT, remote: 'origin', url: `https://github.com/${OWNER}/${REPO}.git` });
      }
      try {
        await git.fetch({ fs, dir: ROOT, http, onAuth: auth, url: `https://github.com/${OWNER}/${REPO}.git`, ref: 'main', singleBranch: true, depth: 1 });
      } catch {}
    }

    // Add changed files
    const matrix = await git.statusMatrix({ fs, dir: ROOT });
    let changed = 0;
    for (const [filepath, , workStatus] of matrix) {
      if (IGNORE.some(i => filepath.includes(i))) continue;
      if (workStatus !== 1) {
        await git.add({ fs, dir: ROOT, filepath });
        changed++;
      }
    }
    if (changed === 0) return;

    await git.commit({ fs, dir: ROOT, author: { name: 'JairoNP300', email: 'jairo@example.com' }, message: `Auto-deploy: ${new Date().toLocaleString('es-SV')}` });
    await git.push({ fs, dir: ROOT, http, onAuth: auth, url: `https://github.com/${OWNER}/${REPO}.git`, ref: 'main' });
    console.log(`📤 ${changed} archivo(s) → GitHub`);
    await triggerWebhooks();
  } catch (e) {
    if (!e.message?.includes('index.lock')) {
      console.error('❌', e.message.slice(0, 100));
    }
  }
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(pushChanges, DEBOUNCE_MS);
}

function shouldIgnore(filename) {
  return !filename || IGNORE.some(i => filename.includes(i));
}

console.log(`🚀 Auto-deploy ${TOKEN ? '✅ activo' : '⚠️ inactivo (sin GITHUB_TOKEN)'}`);
if (!TOKEN) process.exit(1);

// Initial push
pushChanges();

watch(ROOT, { recursive: true }, (_, filename) => {
  if (!shouldIgnore(filename)) schedule();
});
