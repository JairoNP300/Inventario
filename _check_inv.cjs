const db = require('better-sqlite3')('./inventario_oficial.db', { readonly: true });

// Check warehouse mapping
console.log('=== MOVEMENTS (to understand bodega mapping) ===');
const movs = db.prepare('SELECT DISTINCT origin_warehouse, dest_warehouse FROM movements').all();
console.log('Warehouses used:', movs);

// Check inventory
console.log('\n=== INVENTORY ===');
const rows = db.prepare('SELECT i.*, p.name FROM inventory i JOIN products p ON i.product_id = p.id ORDER BY i.product_id').all();
rows.forEach(r => {
  console.log(`  ${r.name} (pid:${r.product_id}): b1=${r.bodega_1}, b2=${r.bodega_2}, b3=${r.bodega_3}, b4=${r.bodega_4}, cajas=${r.cajas}, ent_caj=${r.entradas_cajas}, sal_caj=${r.salidas_cajas}, cur_stk=${r.current_stock}`);
});

// Check production_logs
console.log('\n=== PRODUCTION LOGS ===');
const plogs = db.prepare('SELECT * FROM production_logs ORDER BY date DESC').all();
plogs.forEach(r => console.log(`  id:${r.id} pid:${r.product_id} init:${r.initial_weight} cut:${r.cut_weight} waste:${r.waste} date:${r.date}`));

// Check stock_adjustments
console.log('\n=== STOCK ADJUSTMENTS ===');
const adjs = db.prepare('SELECT * FROM stock_adjustments ORDER BY created_at DESC LIMIT 20').all();
adjs.forEach(r => console.log(`  id:${r.id} pid:${r.product_id} wh:${r.warehouse} col:${r.bodega_col} change:${r.weight_change} cajas_chg:${r.cajas_change} role:${r.role} at:${r.created_at}`));

db.close();
