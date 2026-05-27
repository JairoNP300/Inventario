import { Client } from 'pg';
const client = new Client({
  connectionString: 'postgresql://inventario_db_10qr_user:ydiOhILknw2F4jI9V0mLH2aEg59gdE5g@dpg-d7j7v9rbc2fs739bovg0-a.oregon-postgres.render.com/inventario_db_10qr',
  ssl: { rejectUnauthorized: false }
});
await client.connect();

// Ensure columns exist first
try { await client.query('ALTER TABLE inventory ADD COLUMN entradas_cajas DECIMAL(10,2) DEFAULT 0'); } catch(e) { console.log('entradas_cajas column ok'); }
try { await client.query('ALTER TABLE inventory ADD COLUMN salidas_cajas DECIMAL(10,2) DEFAULT 0'); } catch(e) { console.log('salidas_cajas column ok'); }

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
for (const c of cajas) {
  const r = await client.query('SELECT id FROM products WHERE code = $1', [c.code]);
  if (r.rows.length > 0) {
    await client.query('UPDATE inventory SET entradas_cajas = $1, salidas_cajas = $2 WHERE product_id = $3', [c.entradas, c.salidas, r.rows[0].id]);
    console.log('PG actualizado ' + c.code + ': entradas=' + c.entradas + ', salidas=' + c.salidas);
  }
}
const verify = await client.query('SELECT p.code, i.entradas_cajas, i.salidas_cajas FROM products p LEFT JOIN inventory i ON p.id = i.product_id ORDER BY CAST(p.code AS INTEGER)');
console.table(verify.rows);
await client.end();
