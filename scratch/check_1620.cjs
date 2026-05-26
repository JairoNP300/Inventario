const Database = require('better-sqlite3');
const fs = require('fs');

const getDbLogs = (dbPath) => {
  try {
    if (!fs.existsSync(dbPath)) return 'File not found';
    const db = new Database(dbPath);
    const stock = db.prepare("SELECT * FROM inventory WHERE product_id = 412").get();
    const prodSum = db.prepare("SELECT SUM(cut_weight) as total FROM production_logs WHERE product_id = 412").get().total || 0;
    const movSum = db.prepare("SELECT SUM(weight) as total FROM movements WHERE product_id = 412").get().total || 0;
    db.close();
    return { stock, prodSum, movSum };
  } catch (e) {
    return e.message;
  }
};

console.log('Main DB (inventario_oficial.db):', getDbLogs('inventario_oficial.db'));
console.log('inventory_agros.db:', getDbLogs('inventory_agros.db'));
console.log('database.db:', getDbLogs('database.db'));
