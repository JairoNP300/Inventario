const Database = require('better-sqlite3');
const db = new Database('inventario_oficial.db');

const logs = db.prepare("SELECT * FROM activity_log WHERE details LIKE '%1620%' OR product_name LIKE '%1620%'").all();
console.log('Activity log count:', logs.length);
console.log(JSON.stringify(logs, null, 2));

db.close();
