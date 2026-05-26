const Database = require('better-sqlite3');
const db = new Database('inventario_oficial.db');

console.log('--- Production logs for 412 ---');
const prodLogs = db.prepare("SELECT * FROM production_logs WHERE product_id = 412").all();
console.log(prodLogs);

const prodLomas = db.prepare("SELECT SUM(cut_weight) as total FROM production_logs WHERE product_id = 412 AND dest_warehouse = 'Lomas de San Francisco'").get();
console.log('Sum of cut_weight to Lomas in production_logs:', prodLomas.total);

console.log('--- Movements for 412 ---');
const movements = db.prepare("SELECT * FROM movements WHERE product_id = 412").all();
console.log(movements);

const movementsLomas = db.prepare("SELECT type, SUM(weight) as total FROM movements WHERE product_id = 412 AND dest_warehouse = 'Lomas de San Francisco' GROUP BY type").all();
console.log('Movements to Lomas:', movementsLomas);

const movementsFromLomas = db.prepare("SELECT type, SUM(weight) as total FROM movements WHERE product_id = 412 AND origin_warehouse = 'Lomas de San Francisco' GROUP BY type").all();
console.log('Movements from Lomas:', movementsFromLomas);

const stock = db.prepare("SELECT * FROM inventory WHERE product_id = 412").get();
console.log('Current stock row:', stock);

db.close();
