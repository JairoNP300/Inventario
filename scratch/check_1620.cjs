const Database = require('better-sqlite3');
const db = new Database('inventario_oficial.db');

const prodLogs = db.prepare("SELECT * FROM production_logs WHERE product_id = 412").all();
console.log('Production logs count:', prodLogs.length);
console.log(JSON.stringify(prodLogs, null, 2));

db.close();
