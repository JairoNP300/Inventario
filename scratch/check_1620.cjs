const Database = require('better-sqlite3');
const db = new Database('inventario_oficial.db');

const movements = db.prepare("SELECT * FROM movements WHERE product_id = 412").all();
console.log('Movements count:', movements.length);
console.log(JSON.stringify(movements, null, 2));

db.close();
