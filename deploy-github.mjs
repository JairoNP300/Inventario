// deploy-github.mjs - Push changes to GitHub + deploy config
// Uses GitHub REST Content API (no git binary needed)
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
  console.log(`
╔══════════════════════════════════════════════════╗
║  Se necesita GITHUB_TOKEN para continuar        ║
╠══════════════════════════════════════════════════╣
║  1. Ve a: https://github.com/settings/tokens    ║
║  2. "Generate new token" → "classic"            ║
║  3. Marca "repo" (full control)                 ║
║  4. Copia el token y ejecuta:                   ║
║                                                  ║
║  set GITHUB_TOKEN=ghp_xxx && node deploy-github.mjs  ║
╚══════════════════════════════════════════════════╝
`);
  process.exit(1);
}

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
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
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

async function uploadFile(relativePath, content) {
  const filePath = path.join(DIR, relativePath.replace(/\//g, path.sep));
  if (!fs.existsSync(filePath)) return;
  
  let sha = null;
  try {
    const existing = await gh('GET', `/contents/${relativePath}`);
    sha = existing.sha;
  } catch (e) {
    // File doesn't exist yet, that's fine
  }

  const content64 = Buffer.from(fs.readFileSync(filePath)).toString('base64');
  
  await gh('PUT', `/contents/${relativePath}`, {
    message: `Actualización automática: ${relativePath}`,
    content: content64,
    sha: sha || undefined,
  });
  console.log(`  ✅ ${relativePath}`);
}

async function main() {
  console.log('\n🚀 Desplegando cambios a GitHub...\n');

  // Archivos que subir
  const files = [
    'src/App.jsx',
    'server/server.js', 
    'server/github-db.js',
    'package.json',
    'vite.config.js',
    'index.html',
    'vercel.json',
    'deploy-github.mjs',
    'deploy.bat',
    'scripts/watch-deploy.js',
    'data/data.json',
  ];

  for (const f of files) {
    if (fs.existsSync(path.join(DIR, f.replace(/\//g, path.sep)))) {
      await uploadFile(f);
    }
  }

  console.log('\n🎉 ¡Cambios subidos a GitHub!');
  console.log(`   https://github.com/${OWNER}/${REPO}`);

  // Verificar último commit
  try {
    const commits = await gh('GET', '/commits?per_page=1');
    console.log(`   Último commit: ${commits[0].sha.substring(0, 7)} - ${commits[0].commit.message.split('\\n')[0]}`);
  } catch {}

  console.log('\n🔄 Vercel/Render se actualizarán automáticamente con el push.');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
