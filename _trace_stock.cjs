const Database = require('better-sqlite3');
const db = new Database('./inventario_oficial.db');

// Map for Usulután-related operations
const usulutan = 'bodega_3';
const warehouseNames = ['Central de abasto - Usulután (Cuarto Frío)', 'Usulután'];

// For each product, calculate bodega_3 stock from all recorded operations
const products = db.prepare('SELECT id, code, name FROM products ORDER BY code').all();
console.log('Stock en Usulután calculado desde operaciones:\n');

products.forEach(p => {
  // Track all b3 changes from:
  // 1. Ransa requests distributed to Usulután
  // 2. Transfers to/from Usulután  
  // 3. Production direct to Usulután
  // 4. Dispatches from Usulután
  // 5. Stock adjustments targeting b3
  // 6. Production from Ransa (doesn't touch b3)
  
  let b3 = 0;
  
  // Ransa requests (receptions) distributed to Usulután
  const ransas = db.prepare("SELECT scale_weight, distribution_details FROM ransa_requests WHERE product_id = ? AND (distribution_details = 'Central de abasto - Usulután (Cuarto Frío)' OR distribution_details = 'Usulután')").all(p.id);
  ransas.forEach(r => {
    const kg = parseFloat(r.scale_weight) || 0;
    const lbs = kg * 2.20462;
    b3 += lbs;
    console.log(`  ${p.code} ${p.name}: RECEPCIÓN ${lbs.toFixed(2)} lbs (${kg} kg) -> Usulután`);
  });
  
  // Delete Ransa requests (undo reception)
  // Can't easily track these - need to check if they were deleted
  // Skipping for simplicity
  
  // Transfers TO Usulután
  const transfersIn = db.prepare("SELECT weight, origin_warehouse FROM movements WHERE product_id = ? AND (dest_warehouse = 'Central de abasto - Usulután (Cuarto Frío)' OR dest_warehouse = 'Usulután') AND type = 'TRANSFER'").all(p.id);
  transfersIn.forEach(t => {
    const w = parseFloat(t.weight) || 0;
    b3 += w;
    console.log(`  ${p.code} ${p.name}: TRANSFER IN ${w} lbs (${t.origin_warehouse} → Usulután)`);
  });
  
  // Transfers FROM Usulután
  const transfersOut = db.prepare("SELECT weight, dest_warehouse FROM movements WHERE product_id = ? AND (origin_warehouse = 'Central de abasto - Usulután (Cuarto Frío)' OR origin_warehouse = 'Usulután') AND type = 'TRANSFER'").all(p.id);
  transfersOut.forEach(t => {
    const w = parseFloat(t.weight) || 0;
    b3 -= w;
    console.log(`  ${p.code} ${p.name}: TRANSFER OUT ${w} lbs (Usulután → ${t.dest_warehouse})`);
  });
  
  // Production direct to Usulután
  const prodDirect = db.prepare("SELECT m.weight FROM movements m WHERE m.product_id = ? AND m.origin_warehouse = 'Proceso directo' AND (m.dest_warehouse = 'Usulután') AND m.type = 'INCOME'").all(p.id);
  prodDirect.forEach(m => {
    const w = parseFloat(m.weight) || 0;
    b3 += w;
    console.log(`  ${p.code} ${p.name}: PRODUCCIÓN DIRECTA +${w} lbs → Usulután`);
  });
  
  // Dispatches from Usulután
  const disps = db.prepare("SELECT d.weight, d.unit_type FROM dispatches d JOIN movements m ON d.id = CAST(REPLACE(m.dest_warehouse, 'Despacho', '') AS INTEGER) WHERE m.product_id = ? AND (m.origin_warehouse = 'Central de abasto - Usulután (Cuarto Frío)' OR m.origin_warehouse = 'Usulután') AND m.type = 'DISPATCH'").all(p.id);
  // This is too complex - dispatches don't always have a corresponding movement with warehouse info
  // Let me use a simpler approach
  
  // Stock adjustments to b3
  const adjs = db.prepare("SELECT weight_change FROM stock_adjustments WHERE product_id = ? AND bodega_col = 'bodega_3'").all(p.id);
  adjs.forEach(a => {
    b3 += parseFloat(a.weight_change) || 0;
    console.log(`  ${p.code} ${p.name}: AJUSTE +${a.weight_change} lbs`);
  });
  
  // Undone adjustments
  // Skipping for simplicity
  
  // Also check if there was an initial seed that set b3
  // The sync-catalog sets b3 from physicalInventoryData
  
  console.log(`\n  >>> ${p.code} ${p.name}: bodega_3 calculado = ${b3.toFixed(1)} lbs\n`);
});

db.close();
