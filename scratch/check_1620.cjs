const Database = require('better-sqlite3');
const db = new Database('inventario_oficial.db');

// Check current stock
const stock = db.prepare("SELECT bodega_4 FROM inventory WHERE product_id = 412").get();
console.log('Current stock in Lomas:', stock.bodega_4);

// If it's not 163.02, let's update it to 163.02
if (stock.bodega_4 !== 163.02) {
  console.log('Updating stock to 163.02...');
  db.prepare("UPDATE inventory SET bodega_4 = 163.02 WHERE product_id = 412").run();
  console.log('Stock updated successfully.');
} else {
  console.log('Stock is already correct (163.02).');
}

db.close();
