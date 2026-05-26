const Database = require('better-sqlite3');
const db = new Database('inventario_oficial.db');

const logs = db.prepare("SELECT * FROM activity_log WHERE product_name = 'HUESO DE YUGO / COGOTE CON HUESO' OR details LIKE '%HUESO DE YUGO%'").all();
console.log('Activity log count for HUESO DE YUGO:', logs.length);
console.log(JSON.stringify(logs, null, 2));

db.close();
