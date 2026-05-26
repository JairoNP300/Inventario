const Database = require('better-sqlite3');
const db = new Database('inventario_oficial.db');

const cols = db.prepare("PRAGMA table_info(activity_log)").all();
console.log('Columns:', cols.map(c => c.name));

const logs = db.prepare("SELECT * FROM activity_log LIMIT 10").all();
console.log('First 10 activity logs:', logs);

db.close();
