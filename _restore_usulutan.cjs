const Database = require('better-sqlite3');
const db = new Database('./inventario_oficial.db');

// Bodega 3 = Usulután
// Restore to physical inventory seed values (the baseline)
const seedData = {
  "1618": { b3: 9168.1 },
  "1619": { b3: 5948.9 },
  "1620": { b3: 0 },
  "1621": { b3: 0 },
  "1622": { b3: 0 },
  "1623": { b3: 0 },
  "1624": { b3: 4808.9 },
  "1625": { b3: 0 },
  "1626": { b3: 1072.3 },
  "1627": { b3: 0 },
  "1628": { b3: 5595.4 }
};

console.log('=== Current vs Restored Usulután (bodega_3) ===');
const before = db.prepare('SELECT p.code, p.name, i.bodega_3 FROM inventory i JOIN products p ON i.product_id = p.id ORDER BY p.code').all();
before.forEach(r => {
  const seed = seedData[r.code];
  if (seed) {
    const diff = r.bodega_3 - seed.b3;
    if (Math.abs(diff) > 0.01) {
      console.log(`  ${r.code} | ${r.name}: ${r.bodega_3} → ${seed.b3} (diff: ${diff >= 0 ? '+' : ''}${diff.toFixed(1)})`);
    } else {
      console.log(`  ${r.code} | ${r.name}: ✓ (${r.bodega_3})`);
    }
  }
});

const update = db.prepare('UPDATE inventory SET bodega_3 = ? WHERE product_id = (SELECT id FROM products WHERE code = ?)');
const txn = db.transaction(() => {
  for (const [code, data] of Object.entries(seedData)) {
    update.run(data.b3, code);
  }
});
txn();

console.log('\n✓ Usulután restored to seed values');
db.close();
