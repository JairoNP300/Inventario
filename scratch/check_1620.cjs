const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const checkDb = (dbPath) => {
  try {
    const db = new Database(dbPath);
    // check if inventory exists
    const stock = db.prepare("SELECT * FROM inventory WHERE product_id = 412").get();
    db.close();
    return stock;
  } catch (e) {
    return e.message;
  }
};

console.log('Main DB stock:', checkDb('inventario_oficial.db'));

const backupsDir = 'backups';
if (fs.existsSync(backupsDir)) {
  const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.db'));
  files.forEach(f => {
    const filePath = path.join(backupsDir, f);
    console.log(`${f} stock:`, checkDb(filePath));
  });
}
