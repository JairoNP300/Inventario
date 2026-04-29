import { watch, existsSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../');
dotenv.config({ path: join(ROOT, '.env') });
const DEBOUNCE_MS = 5000;
const RENDER_DEPLOY_HOOK_URL = process.env.RENDER_DEPLOY_HOOK_URL || '';

// Archivos/carpetas a ignorar
const IGNORE = [
    'node_modules',
    '.git',
    'dist',
    '.github',
    'scratch',
    'inventario_oficial.db-wal',
    'inventario_oficial.db-shm',
    '.timestamp-',
    '.tmp',
    '.swp'
];

console.log('🚀 SISTEMA DE SINCRONIZACIÓN AUTOMÁTICA (CLOUD) INICIADO');
console.log('👀 Vigilando cambios en todos los archivos del proyecto...');

let timer = null;
let pendingChanges = false;

function shouldIgnore(filename) {
    if (!filename) return true;
    return IGNORE.some(ig => filename.includes(ig));
}

function clearStaleGitLockIfNeeded() {
    const lockPath = join(ROOT, '.git', 'index.lock');
    if (existsSync(lockPath)) {
        try {
            unlinkSync(lockPath);
            console.log('🧹 Lock de git anterior eliminado automáticamente (.git/index.lock).');
        } catch (e) {
            console.warn('⚠️ No se pudo eliminar .git/index.lock automáticamente:', e.message);
        }
    }
}

async function triggerRenderDeployHook() {
    if (!RENDER_DEPLOY_HOOK_URL) {
        console.log('ℹ️ RENDER_DEPLOY_HOOK_URL no configurada. Se usará solo auto-deploy por git push.');
        return;
    }

    try {
        const res = await fetch(RENDER_DEPLOY_HOOK_URL, { method: 'POST' });
        if (!res.ok) {
            console.warn(`⚠️ Hook de Render respondió ${res.status}. Revisa la URL del deploy hook.`);
            return;
        }
        console.log('🚀 Deploy de Render disparado por webhook.');
    } catch (e) {
        console.warn('⚠️ No se pudo disparar webhook de Render:', e.message);
    }
}

async function deploy() {
    try {
        console.log('\n📤 Cambios detectados. Sincronizando con la nube (GitHub/Render)...');
        clearStaleGitLockIfNeeded();
        
        // Verificar si hay cambios antes de hacer nada
        const status = execSync('git status --porcelain', { cwd: ROOT }).toString().trim();
        if (!status) {
            console.log('✅ No hay cambios reales para subir.');
            return;
        }

        const timestamp = new Date().toLocaleString('es-MX');
        execSync('git add .', { cwd: ROOT, stdio: 'inherit' });
        execSync(`git commit -m "Actualización automática: ${timestamp}"`, { cwd: ROOT, stdio: 'inherit' });
        execSync('git push origin main', { cwd: ROOT, stdio: 'inherit' });
        await triggerRenderDeployHook();
        
        console.log(`✅ ¡Cambios subidos con éxito!`);
        console.log(`🚀 Render se está actualizando automáticamente.`);
        console.log(`   (La URL pública se actualizará en unos minutos)\n`);
    } catch (e) {
        if (String(e.message || '').includes('index.lock')) {
            console.warn('⚠️ Se detectó bloqueo de git, se reintentará en el próximo ciclo.');
        }
        console.error('❌ Error en sincronización:', e.message);
    }
}

async function deployOnStartupIfNeeded() {
    try {
        const status = execSync('git status --porcelain', { cwd: ROOT }).toString().trim();
        if (status) {
            console.log('\n📌 Cambios pendientes detectados al iniciar. Publicando automáticamente...');
            await deploy();
        } else {
            console.log('✅ Repositorio limpio al iniciar. Esperando nuevos cambios...');
        }
    } catch (e) {
        console.error('❌ Error verificando cambios iniciales:', e.message);
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

// AUTO-DEPLOY RE-ENABLED - PostgreSQL will be used for persistent storage
// When DATABASE_URL is configured, the system uses PostgreSQL instead of SQLite

console.log('✅ Auto-deploy HABILITADO');
console.log('💡 Sistema usará PostgreSQL cuando DATABASE_URL esté configurado');

watch(ROOT, { recursive: true }, (event, filename) => {
    if (filename && !shouldIgnore(filename)) {
        console.log(`📝 Archivo modificado: ${filename}`);
        scheduleDeployment();
    }
});

deployOnStartupIfNeeded();

console.log('✅ Sistema funcionando con auto-deploy activo\n');
