// deploy-github.mjs — Push rápido a GitHub + Vercel/Render
// Usa la API "Create a Commit" de GitHub (commit único con todos los archivos)
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = __dirname;
const OWNER = 'JairoNP300';
const REPO = 'Inventario';

const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.log(`\n⚠️  Se necesita GITHUB_TOKEN\n  set GITHUB_TOKEN=ghp_xxx && node deploy-github.mjs\n`);
  process.exit(1);
}

function api(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}${urlPath}`,
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
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0,200)}`));
        } else {
          try { resolve(JSON.parse(data)); }
          catch { resolve(data); }
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function triggerWebhooks() {
  const hooks = [
    { url: process.env.VERCEL_DEPLOY_HOOK_URL, name: 'Vercel' },
    { url: process.env.RENDER_DEPLOY_HOOK_URL, name: 'Render' },
  ];
  for (const { url, name } of hooks) {
    if (!url) continue;
    try {
      const start = Date.now();
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const ms = Date.now() - start;
      console.log(`  🔄 ${name}: ${res.ok ? '✅' : '⚠️ '+res.status} (${ms}ms)`);
    } catch (e) {
      console.log(`  ⚠️ ${name}: ${e.message}`);
    }
  }
}

async function main() {
  console.log('\n🚀 Deploy rápido a GitHub + Vercel/Render...\n');

  const files = [
    'src/App.jsx', 'server/server.js', 'server/github-db.js',
    'package.json', 'package-lock.json', 'vite.config.js', 'index.html',
    'vercel.json', 'deploy-github.mjs', 'deploy.bat',
    'scripts/watch-deploy.js', '.github/workflows/deploy.yml',
    'data/data.json', 'server/seed-data.json',
  ];

  // 1. Crear blobs para cada archivo
  console.log('📦 Preparando archivos...');
  const treeEntries = [];
  for (const f of files) {
    const fp = path.join(DIR, f.replace(/\//g, path.sep));
    if (!fs.existsSync(fp)) continue;
    const content = fs.readFileSync(fp).toString('base64');
    const blob = await api('POST', '/git/blobs', { content, encoding: 'base64' });
    treeEntries.push({ path: f, mode: '100644', type: 'blob', sha: blob.sha });
  }
  console.log(`   ${treeEntries.length} blob(s) creados`);

  // 2. Obtener el commit actual de main
  let parentSha = null;
  try {
    const ref = await api('GET', '/git/ref/heads/main');
    parentSha = ref.object.sha;
  } catch {
    // Primer commit en repo vacío
  }

  // 3. Crear un tree con todos los archivos
  const tree = await api('POST', '/git/trees', {
    base_tree: parentSha || undefined,
    tree: treeEntries,
  });
  console.log(`   Tree ${tree.sha.substring(0, 7)}`);

  // 4. Crear commit único
  const timestamp = new Date().toLocaleString('es-SV');
  const commit = await api('POST', '/git/commits', {
    message: `Auto-deploy: ${timestamp}`,
    tree: tree.sha,
    parents: parentSha ? [parentSha] : [],
    author: { name: 'JairoNP300', email: 'jairo@example.com' },
  });
  console.log(`💾 Commit: ${commit.sha.substring(0, 7)}`);

  // 5. Actualizar la referencia main
  await api('PATCH', '/git/refs/heads/main', {
    sha: commit.sha,
    force: false,
  });
  console.log('✅ Push completado');

  // 6. Trigger webhooks inmediatamente
  console.log('\n🔄 Disparando deploys...');
  await triggerWebhooks();

  console.log(`\n✅ Todo listo — https://github.com/${OWNER}/${REPO}`);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
