const Database = require('better-sqlite3');
const db = new Database('./inventario_oficial.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Tables:', JSON.stringify(tables.map(t=>t.name)));
tables.forEach(t => {
  const cols = db.prepare('PRAGMA table_info(' + t.name + ')').all();
  console.log(t.name + ':');
  cols.forEach(c => console.log('  ' + c.name + ' (' + c.type + ')'));
});
db.close();
