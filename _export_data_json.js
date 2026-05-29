import pg from 'pg';
import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({
  connectionString: 'postgresql://inventario_db_10qr_user:ydiOhILknw2F4jI9V0mLH2aEg59gdE5g@dpg-d7j7v9rbc2fs739bovg0-a.oregon-postgres.render.com/inventario_db_10qr',
  ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000
});

async function q(sql) { const r = await pool.query(sql); return r.rows; }

const tables = ['products','agros','inventory','movements','activity_log','production_logs','ransa_requests','dispatches','sales','orders','food_costing','stock_adjustments'];
const data = {};
for (const t of tables) {
  try { data[t] = await q(`SELECT * FROM ${t} ORDER BY ${t === 'inventory' ? 'product_id' : 'id'}`); }
  catch(e) { data[t] = []; console.warn(t, ':', e.message); }
  console.log(`${t}: ${data[t].length} rows`);
}

await writeFile(join(__dirname, 'data', 'data.json'), JSON.stringify(data, null, 2));
console.log('✅ data.json saved');
await pool.end();
