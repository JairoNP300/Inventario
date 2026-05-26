const db = require('better-sqlite3')('./inventario_oficial.db', { readonly: true });
const rows = db.prepare('SELECT id, code, name FROM products ORDER BY id').all();
console.log('Product codes:');
rows.forEach(r => console.log(`  id:${r.id} code:${r.code} name:${r.name}`));
db.close();
