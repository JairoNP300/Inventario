const db = require('better-sqlite3')('./inventario_oficial.db', { readonly: true });
// Check production_logs more detail - need to check if there's process_mode or dest_warehouse
const plogs = db.prepare('SELECT * FROM production_logs ORDER BY id').all();
console.log('All production_logs columns:');
plogs.forEach(r => {
  console.log(`ID:${r.id} | pid:${r.product_id} | init:${r.initial_weight} | cut:${r.cut_weight} | waste:${r.waste} | sc:${r.storage_cost} tc:${r.transport_cost} lc:${r.labor_cost} oc:${r.other_costs} | date:${r.date}`);
  console.log(`  All keys: ${Object.keys(r).join(', ')}`);
});

// Also check the activity_log for production entries
const acts = db.prepare("SELECT * FROM activity_log WHERE action = 'PRODUCCIÓN' ORDER BY id DESC LIMIT 10").all();
console.log('\nProduction activity_log entries:');
acts.forEach(r => console.log(`  ID:${r.id} | details:${r.details} | prod:${r.product_name} | qty:${r.quantity} | loc:${r.location} | at:${r.created_at}`));

db.close();
