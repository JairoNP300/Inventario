import Database from 'better-sqlite3';
const db = new Database('inventario_oficial.db');

const weightTotals = {
  "1618": { usulutanKg: 1517.28, ransaKg: 0 },
  "1619": { usulutanKg: 2395.38, ransaKg: 0 },
  "1624": { usulutanKg: 1848.24, ransaKg: 0 },
  "1626": { usulutanKg: 1072.28, ransaKg: 0 },
  "1628": { usulutanKg: 2189.20, ransaKg: 0 },
  "1620": { usulutanKg: 0, ransaKg: 0 },
  "1621": { usulutanKg: 0, ransaKg: 0 },
  "1622": { usulutanKg: 0, ransaKg: 0 },
  "1623": { usulutanKg: 0, ransaKg: 0 },
  "1625": { usulutanKg: 0, ransaKg: 0 },
  "1627": { usulutanKg: 0, ransaKg: 0 }
};

const cajas = [
  { code: '1618', entradas: 326, salidas: 325 },
  { code: '1619', entradas: 200, salidas: 152 },
  { code: '1620', entradas: 114, salidas: 105 },
  { code: '1621', entradas: 45, salidas: 32 },
  { code: '1622', entradas: 43, salidas: 20 },
  { code: '1623', entradas: 45, salidas: 34 },
  { code: '1624', entradas: 105, salidas: 103 },
  { code: '1625', entradas: 55, salidas: 55 },
  { code: '1626', entradas: 46, salidas: 46 },
  { code: '1627', entradas: 53, salidas: 21 },
  { code: '1628', entradas: 186, salidas: 137 }
];

try { db.exec('ALTER TABLE inventory ADD COLUMN entradas_cajas DECIMAL(10,2) DEFAULT 0'); } catch(e) {}
try { db.exec('ALTER TABLE inventory ADD COLUMN salidas_cajas DECIMAL(10,2) DEFAULT 0'); } catch(e) {}

db.exec('BEGIN TRANSACTION');

// 1. Update cajas from seed_cajas_pg.js
for (const c of cajas) {
  const row = db.prepare('SELECT id FROM products WHERE code = ?').get(c.code);
  if (row) {
    db.prepare(`
      INSERT INTO inventory (product_id, entradas_cajas, salidas_cajas) 
      VALUES (?, ?, ?) 
      ON CONFLICT(product_id) DO UPDATE SET entradas_cajas=excluded.entradas_cajas, salidas_cajas=excluded.salidas_cajas
    `).run(row.id, c.entradas, c.salidas);
  }
}

// 2. Update weightTotals from App.jsx
for (const [code, data] of Object.entries(weightTotals)) {
  const row = db.prepare('SELECT id FROM products WHERE code = ?').get(code);
  if (row) {
    const usulutanLbs = data.usulutanKg * 2.20462;
    const ransaKg = data.ransaKg;
    // Set bodega_3 (Usulután) and bodega_1 (Ransa)
    // Wipe others (bodega_2, bodega_4) to zero out if these are the latest exact quantities? 
    // The instructions say "integra las ultimas cantidades". Let's set exactly these and zero others.
    db.prepare(`
      UPDATE inventory 
      SET bodega_1 = ?, bodega_2 = 0, bodega_3 = ?, bodega_4 = 0 
      WHERE product_id = ?
    `).run(ransaKg, usulutanLbs, row.id);
    console.log(`Updated product code ${code}: Ransa = ${ransaKg} Kg, Usulután = ${usulutanLbs.toFixed(2)} Lbs`);
  }
}

// Re-calculate final_stock if it exists
try {
  db.exec(`
    UPDATE inventory 
    SET final_stock = (bodega_1 * 2.20462) + bodega_2 + bodega_3 + bodega_4
  `);
} catch (e) {
  // Ignore if final_stock doesn't exist
}

db.exec('COMMIT');
console.log('Successfully integrated latest quantities into SQLite.');
