const db = require('better-sqlite3')('./inventario_oficial.db', { readonly: true });

console.log('=== BODEGA MAPPING ===');
console.log('bodega_1 = Ransa (KG)');
console.log('bodega_2 = Soyapango (LBS)');  
console.log('bodega_3 = Usulután (LBS)');
console.log('bodega_4 = Lomas (LBS)');

console.log('\n=== ALL PRODUCTS WITH INVENTORY ===');
const rows = db.prepare('SELECT i.*, p.name, p.price_per_lb FROM inventory i JOIN products p ON i.product_id = p.id ORDER BY p.name').all();
rows.forEach(r => {
  console.log(`${r.name}`);
  console.log(`  Ransa(KG): ${r.bodega_1} | Soyapango: ${r.bodega_2} | Usulután: ${r.bodega_3} | Lomas: ${r.bodega_4}`);
  console.log(`  Cajas: ent=${r.entradas_cajas} sal=${r.salidas_cajas} stock_cajas=${r.entradas_cajas - r.salidas_cajas} | cur_stk=${r.current_stock}`);
});

console.log('\n=== PRODUCTION LOGS ===');
const plogs = db.prepare('SELECT pl.*, p.name FROM production_logs pl JOIN products p ON pl.product_id = p.id ORDER BY pl.date DESC').all();
plogs.forEach(r => console.log(`  ID:${r.id} | ${r.name} | init:${r.initial_weight} cut:${r.cut_weight} waste:${r.waste} date:${r.date}`));

console.log('\n=== RECENT MOVEMENTS ===');
const movs = db.prepare('SELECT m.*, p.name FROM movements m JOIN products p ON m.product_id = p.id ORDER BY m.id DESC LIMIT 20').all();
movs.forEach(r => console.log(`  ID:${r.id} | ${r.name} | ${r.origin_warehouse}→${r.dest_warehouse} | ${r.weight} ${r.unit_type} | ${r.date}`));

console.log('\n=== STOCK ADJUSTMENTS (recent) ===');
const adjs = db.prepare('SELECT sa.*, p.name FROM stock_adjustments sa JOIN products p ON sa.product_id = p.id ORDER BY sa.created_at DESC LIMIT 10').all();
adjs.forEach(r => console.log(`  ID:${r.id} | ${r.name} | wh:${r.warehouse} col:${r.bodega_col} wt:${r.weight_change} cj:${r.cajas_change} | ${r.created_at}`));

console.log('\n=== RANSA REQUESTS ===');
const ransas = db.prepare('SELECT rr.*, p.name FROM ransa_requests rr JOIN products p ON rr.product_id = p.id ORDER BY rr.date DESC').all();
ransas.forEach(r => console.log(`  ID:${r.id} | ${r.name} | tag:${r.tag_weight} scale:${r.scale_weight} units:${r.units_per_box} dist:${r.distribution_details} | ${r.date}`));

console.log('\n=== DISPATCHES (recent 10) ===');
const disps = db.prepare('SELECT d.*, p.name FROM dispatches d JOIN products p ON d.product_id = p.id ORDER BY d.id DESC LIMIT 10').all();
disps.forEach(r => console.log(`  ID:${r.id} | ${r.name} | agro:${r.agro_id} | wt:${r.weight} ${r.unit_type} | val:${r.value} | ${r.date}`));

db.close();
