const db = require('better-sqlite3')('./inventario_oficial.db', { readonly: true });
const movs = db.prepare('SELECT * FROM movements ORDER BY id DESC LIMIT 30').all();
console.log('All recent movements:');
movs.forEach(r => console.log(`  ${r.id} | ${r.product_id} | ${r.origin_warehouse}→${r.dest_warehouse} | ${r.weight} ${r.unit_type} | ${r.type} | ${r.date}`));

// Also check ALL movements for Posta Negra (pid:410)
console.log('\nAll movements for pid=410:');
const pmovs = db.prepare('SELECT * FROM movements WHERE product_id = 410 ORDER BY id').all();
pmovs.forEach(r => console.log(`  ${r.id} | ${r.origin_warehouse}→${r.dest_warehouse} | ${r.weight} ${r.unit_type} | ${r.type} | ${r.date}`));

db.close();
