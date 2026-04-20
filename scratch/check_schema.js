
import Database from 'better-sqlite3';
const db = new Database('inventario_oficial.db');

const tables = ['products', 'agros', 'inventory', 'movements', 'production_logs', 'ransa_requests', 'dispatches', 'sales', 'orders', 'food_costing'];

for (const table of tables) {
  try {
    const info = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`).get();
    console.log(`--- ${table} ---`);
    console.log(info ? info.sql : 'Table not found');
  } catch (e) {
    console.error(`Error reading ${table}:`, e.message);
  }
}

db.close();
