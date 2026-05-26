const db = require('better-sqlite3')('./inventario_oficial.db', { readonly: true });

const adjs = db.prepare('SELECT sa.*, p.name FROM stock_adjustments sa JOIN products p ON sa.product_id = p.id ORDER BY sa.id').all();
console.log('ALL stock_adjustments:');
adjs.forEach(r => console.log(`  ${r.id} | ${r.name} | wh:${r.warehouse} col:${r.bodega_col} wt:${r.weight_change} cj:${r.cajas_change} role:${r.role} at:${r.created_at}`));

const acts = db.prepare("SELECT * FROM activity_log WHERE action IN ('AJUSTE STOCK', 'RECEPCIÓN', 'PRODUCCIÓN') ORDER BY id").all();
console.log('\nALL activity_log entries for stock changes:');
acts.forEach(r => console.log(`  ${r.id} | ${r.action} | prod:${r.product_name} | qty:${r.quantity} | loc:${r.location} | det:${r.details} | at:${r.created_at}`));

db.close();
