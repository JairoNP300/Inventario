import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function consolidateInventory() {
  try {
    const dataPath = join(__dirname, 'data', 'data.json');
    const rawData = await readFile(dataPath, 'utf-8');
    const data = JSON.parse(rawData);

    console.log('🔄 Consolidando inventario y eliminando duplicados...\n');

    // Detectar duplicados por product_id
    const productIdMap = {};
    const consolidated = [];
    let duplicatesRemoved = 0;

    for (const inv of data.inventory) {
      const pid = inv.product_id;
      
      if (productIdMap[pid]) {
        // Ya existe un registro para este product_id
        const existing = productIdMap[pid];
        
        // Mantener los valores más significativos (no cero)
        if (inv.bodega_1 !== 0 && existing.bodega_1 === 0) existing.bodega_1 = inv.bodega_1;
        if (inv.bodega_2 !== 0 && existing.bodega_2 === 0) existing.bodega_2 = inv.bodega_2;
        if (inv.bodega_3 !== 0 && existing.bodega_3 === 0) existing.bodega_3 = inv.bodega_3;
        if (inv.bodega_4 !== 0 && existing.bodega_4 === 0) existing.bodega_4 = inv.bodega_4;
        if (inv.entradas_cajas !== 0 && existing.entradas_cajas === 0) existing.entradas_cajas = inv.entradas_cajas;
        if (inv.salidas_cajas !== 0 && existing.salidas_cajas === 0) existing.salidas_cajas = inv.salidas_cajas;
        if (inv.cajas !== 0 && existing.cajas === 0) existing.cajas = inv.cajas;
        
        console.log(`   ⚠️  Duplicado detectado para product_id=${pid}`);
        console.log(`       Consolidado con valores existentes`);
        duplicatesRemoved++;
      } else {
        // Primer registro para este product_id
        productIdMap[pid] = inv;
        consolidated.push(inv);
      }
    }

    data.inventory = consolidated;

    console.log(`\n✅ Consolidación completada`);
    console.log(`   • Duplicados eliminados: ${duplicatesRemoved}`);
    console.log(`   • Registros finales: ${data.inventory.length}\n`);

    // Verificar integridad
    console.log('🔍 Verificando integridad del inventario...\n');
    
    let issues = 0;
    for (const inv of data.inventory) {
      const product = data.products.find(p => p.id === inv.product_id);
      if (!product) {
        console.log(`   ❌ product_id=${inv.product_id} no existe en catálogo`);
        issues++;
      }
    }

    if (issues === 0) {
      console.log('   ✅ Todos los registros de inventario tienen productos válidos\n');
    }

    // Guardar datos consolidados
    await writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`📁 Archivo guardado: ${dataPath}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

consolidateInventory();
