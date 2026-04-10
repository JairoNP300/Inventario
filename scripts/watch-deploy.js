import { watch } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../');

console.log('🚀 Sistema de Sincronización Automática Iniciado...');
console.log('📡 Vigila cambios en: /src y /server');

let isSyncing = false;
let pendingSync = false;

const startSync = () => {
    if (isSyncing) {
        pendingSync = true;
        return;
    }

    isSyncing = true;
    pendingSync = false;

    console.log('📦 Detectado cambio. Preparando sincronización...');

    try {
        // Debounce: Wait 5 seconds before pushing to avoid rapid builds
        setTimeout(() => {
            console.log('📤 Subiendo cambios a GitHub...');
            execSync('git add .', { cwd: ROOT });
            
            // Check if there are changes to commit
            const status = execSync('git status --porcelain', { cwd: ROOT }).toString();
            if (status) {
                execSync('git commit -m "Auto-sync: ' + new Date().toLocaleString() + '"', { cwd: ROOT });
                execSync('git push origin main', { cwd: ROOT });
                console.log('✅ Sincronizado correctamente con la nube.');
            } else {
                console.log('ℹ️ Sin cambios relevantes para subir.');
            }
            
            isSyncing = false;
            if (pendingSync) startSync(); // If changes happened during sync, run again
        }, 5000); 

    } catch (error) {
        console.error('❌ Error en sincronización:', error.message);
        isSyncing = false;
    }
};

// Monitor relevant folders
watch(join(ROOT, 'src'), { recursive: true }, (evt, filename) => {
    if (filename) startSync();
});

watch(join(ROOT, 'server'), { recursive: true }, (evt, filename) => {
    if (filename) startSync();
});

console.log('💡 Los cambios se subirán automáticamente a GitHub (Render se actualizará solo).');
