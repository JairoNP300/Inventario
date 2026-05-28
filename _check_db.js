const { Pool } = require('./node_modules/pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:ventas-inventario@db.ygxgdpsmbjggmnioytjv.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
async function check() {
  const { rows } = await pool.query(`
    SELECT p.code, p.name, i.bodega_3, i.bodega_4, i.entradas_cajas, i.salidas_cajas
    FROM inventory i JOIN products p ON i.product_id = p.id
    WHERE i.bodega_3 > 0 OR i.bodega_4 > 0
    ORDER BY p.code
  `);
  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
}
check().catch(e => { console.error('FAIL:', e.message); pool.end(); });
