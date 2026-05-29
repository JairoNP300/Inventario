import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function fixSystemIssues() {
  try {
    const dataPath = join(__dirname, 'data', 'data.json');
    const rawData = await readFile(dataPath, 'utf-8');
    const data = JSON.parse(rawData);

    console.log('🔧 Iniciando diagnóstico y corrección del sistema...\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // PROBLEMA 1: Valores null/undefined en inventory
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('🔍 Problema 1: Valores null/undefined en inventory');
    let nullIssues = 0;
    for (const inv of data.inventory) {
      if (inv.bodega_1 === null || inv.bodega_1 === undefined) {
        inv.bodega_1 = 0;
        nullIssues++;
      }
      if (inv.bodega_3 === null || inv.bodega_3 === undefined) {
        inv.bodega_3 = 0;
        nullIssues++;
      }
      if (inv.salidas_cajas === null || inv.salidas_cajas === undefined) {
        inv.salidas_cajas = 0;
        nullIssues++;
      }
      if (inv.entradas_cajas === null || inv.entradas_cajas === undefined) {
        inv.entradas_cajas = 0;
        nullIssues++;
      }
    }
    console.log(`   ✅ Corregidos ${nullIssues} valores null/undefined\n`);

    // ─────────────────────────────────────────────────────────────────────────────
    // PROBLEMA 2: Duplicados en inventory (mismo product_id)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('🔍 Problema 2: Duplicados en inventory');
    const productIdMap = {};
    const duplicates = [];
    for (let i = 0; i < data.inventory.length; i++) {
      const inv = data.inventory[i];
      const pid = inv.product_id;
      if (productIdMap[pid]) {
        duplicates.push(i);
      } else {
        productIdMap[pid] = i;
      }
    }
    
    if (duplicates.length > 0) {
      console.log(`   ⚠️  Encontrados ${duplicates.length} duplicados`);
      // Mantener el primero, eliminar los demás
      for (let i = duplicates.length - 1; i >= 0; i--) {
        const idx = duplicates[i];
        const removed = data.inventory.splice(idx, 1)[0];
        console.log(`   🗑️  Eliminado: product_id=${removed.product_id}`);
      }
      console.log(`   ✅ Duplicados eliminados\n`);
    } else {
      console.log(`   ✅ Sin duplicados encontrados\n`);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // PROBLEMA 3: product_id como string en lugar de número
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('🔍 Problema 3: Inconsistencia de tipos (product_id string vs número)');
    let typeIssues = 0;
    for (const inv of data.inventory) {
      if (typeof inv.product_id === 'string') {
        inv.product_id = parseInt(inv.product_id);
        typeIssues++;
      }
    }
    console.log(`   ✅ Corregidos ${typeIssues} product_id de string a número\n`);

    // ─────────────────────────────────────────────────────────────────────────────
    // PROBLEMA 4: Verificar que todos los productos tengan inventory
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('🔍 Problema 4: Productos sin registro de inventory');
    let missingInventory = 0;
    for (const product of data.products) {
      const hasInventory = data.inventory.some(inv => inv.product_id === product.id);
      if (!hasInventory) {
        data.inventory.push({
          product_id: product.id,
          bodega_1: 0,
          bodega_2: 0,
          bodega_3: 0,
          bodega_4: 0,
          initial_stock: 0,
          current_stock: 0,
          sold_stock: 0,
          cajas: 0,
          entradas_cajas: 0,
          salidas_cajas: 0
        });
        missingInventory++;
      }
    }
    console.log(`   ✅ Creados ${missingInventory} registros de inventory faltantes\n`);

    // ─────────────────────────────────────────────────────────────────────────────
    // PROBLEMA 5: Valores inconsistentes de cajas (entradas - salidas ≠ stock)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('🔍 Problema 5: Inconsistencia en cálculo de stock de cajas');
    let cajasIssues = 0;
    for (const inv of data.inventory) {
      const entradas = inv.entradas_cajas || 0;
      const salidas = inv.salidas_cajas || 0;
      const expectedStock = entradas - salidas;
      const currentStock = inv.cajas || 0;
      
      if (currentStock !== expectedStock) {
        console.log(`   ⚠️  product_id=${inv.product_id}: cajas=${currentStock}, esperado=${expectedStock}`);
        inv.cajas = expectedStock;
        cajasIssues++;
      }
    }
    console.log(`   ✅ Corregidos ${cajasIssues} cálculos de stock de cajas\n`);

    // ─────────────────────────────────────────────────────────────────────────────
    // PROBLEMA 6: Movimientos huérfanos (product_id que no existe)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('🔍 Problema 6: Movimientos con product_id inválidos');
    const validProductIds = new Set(data.products.map(p => p.id));
    const invalidMovements = [];
    for (let i = 0; i < data.movements.length; i++) {
      const mov = data.movements[i];
      if (!validProductIds.has(mov.product_id) && !validProductIds.has(parseInt(mov.product_id))) {
        invalidMovements.push(i);
      }
    }
    
    if (invalidMovements.length > 0) {
      for (let i = invalidMovements.length - 1; i >= 0; i--) {
        const idx = invalidMovements[i];
        const removed = data.movements.splice(idx, 1)[0];
        console.log(`   🗑️  Eliminado movimiento huérfano: product_id=${removed.product_id}`);
      }
      console.log(`   ✅ Eliminados ${invalidMovements.length} movimientos inválidos\n`);
    } else {
      console.log(`   ✅ Sin movimientos inválidos\n`);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // PROBLEMA 7: Normalizar tipos de datos numéricos
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('🔍 Problema 7: Normalizar tipos de datos numéricos');
    let numericIssues = 0;
    for (const inv of data.inventory) {
      const fields = ['bodega_1', 'bodega_2', 'bodega_3', 'bodega_4', 'initial_stock', 'current_stock', 'sold_stock', 'cajas', 'entradas_cajas', 'salidas_cajas'];
      for (const field of fields) {
        if (typeof inv[field] === 'string') {
          inv[field] = parseFloat(inv[field]) || 0;
          numericIssues++;
        }
      }
    }
    console.log(`   ✅ Normalizados ${numericIssues} valores numéricos\n`);

    // ─────────────────────────────────────────────────────────────────────────────
    // PROBLEMA 8: Eliminar campos innecesarios o redundantes
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('🔍 Problema 8: Limpiar campos redundantes');
    let cleanedFields = 0;
    for (const inv of data.inventory) {
      // Eliminar campos que no son parte del esquema esperado
      if ('id' in inv && typeof inv.id === 'number' && inv.id > 1000) {
        delete inv.id;
        cleanedFields++;
      }
      if ('final_stock' in inv) {
        delete inv.final_stock;
        cleanedFields++;
      }
    }
    console.log(`   ✅ Eliminados ${cleanedFields} campos redundantes\n`);

    // ─────────────────────────────────────────────────────────────────────────────
    // Guardar datos corregidos
    // ─────────────────────────────────────────────────────────────────────────────
    await writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✨ CORRECCIÓN COMPLETADA');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📊 Resumen de correcciones:`);
    console.log(`   • Valores null/undefined: ${nullIssues}`);
    console.log(`   • Duplicados eliminados: ${duplicates.length}`);
    console.log(`   • Tipos corregidos: ${typeIssues}`);
    console.log(`   • Inventarios creados: ${missingInventory}`);
    console.log(`   • Cajas recalculadas: ${cajasIssues}`);
    console.log(`   • Movimientos eliminados: ${invalidMovements.length}`);
    console.log(`   • Valores numéricos normalizados: ${numericIssues}`);
    console.log(`   • Campos limpiados: ${cleanedFields}`);
    console.log(`\n📁 Archivo guardado: ${dataPath}\n`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fixSystemIssues();
