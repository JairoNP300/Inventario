import express from 'express';
// import Database from 'better-sqlite3'; // Moved to dynamic import for production optimization

import cors from 'cors';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import pkg from 'pg';
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../dist')));

// Public URL exposure (for auto-start scripts)
async function getPublicUrl() {
  try {
    const path = join(__dirname, '../PUBLIC_URL.txt');
    const url = (await fs.readFile(path, 'utf8')).trim();
    return url || null;
  } catch (e) {
    return null;
  }
}

app.get('/api/public-url', async (req, res) => {
  const url = await getPublicUrl();
  res.json({ url });
});

// --- DATABASE CONFIGURATION ---
// Production only if DATABASE_URL is actually set
const isProduction = !!process.env.DATABASE_URL;
let pool;
let sqliteDb;

if (isProduction) {
  console.log('🌐 Conectando a PostgreSQL (Producción)...');
  
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      // Force IPv4 to avoid ENETUNREACH error on Render
      host: process.env.DATABASE_URL.match(/@([^:]+)/)?.[1] || undefined
    });
    console.log('✅ PostgreSQL conectado');
  } catch (e) {
    console.error('❌ Error conectando PostgreSQL:', e.message);
    console.log('⚠️ Fallback a SQLite...');
  }
}

// Use SQLite if not in production or if PostgreSQL failed
if (!pool) {
  console.log('📂 Iniciando SQLite...');
  try {
    const Database = (await import('better-sqlite3')).default;
    const dbPath = join(__dirname, '../inventario_oficial.db');
    console.log('📁 Database path:', dbPath);
    sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    console.log('✅ SQLite inicializado');
  } catch (e) {
    console.error('❌ Error cargando SQLite:', e.message);
    process.exit(1);
  }
}

// Unified Query Helper
async function query(sql, params = []) {
  if (isProduction) {
    if (!pool) {
      console.warn('⚠️ Query intentada sin conexión a base de datos (DATABASE_URL faltante).');
      return { rows: [], lastInsertRowid: null };
    }
    // Convert ? to $1, $2, etc for PostgreSQL
    let index = 1;
    const pgSqlFixed = sql.replace(/\?/g, () => `$${index++}`);
    const res = await pool.query(pgSqlFixed, params);
    return {
      rows: res.rows,
      lastInsertRowid: res.rows[0]?.id || null
    };
  } else {
    const stmt = sqliteDb.prepare(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return { rows: stmt.all(...params) };
    } else {
      const info = stmt.run(...params);
      return { lastInsertRowid: info.lastInsertRowid, rows: [] };
    }
  }
}

async function exec(sql) {
  if (isProduction) {
    if (!pool) {
      console.warn('⚠️ Exec intentada sin conexión a base de datos.');
      return { rows: [] };
    }
    // Postgres uses SERIAL or IDENTITY instead of AUTOINCREMENT
    const pgSql = sql
      .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
      .replace(/strftime\('%Y-%m', s.date\)/gi, "to_char(s.date, 'YYYY-MM')");
    return pool.query(pgSql);
  } else {
    return sqliteDb.exec(sql);
  }
}

// --- MIGRATION ---
const migrateDatabase = async () => {
  console.log('Running database migration...');

  // Update agros table with new locations - Safely
  try {
    await query(`
      DELETE FROM agros 
      WHERE id NOT IN (SELECT COALESCE(agro_id, 0) FROM sales)
      AND id NOT IN (SELECT COALESCE(agro_id, 0) FROM dispatches)
    `);
  } catch (e) {
    console.warn('Could not clean up agros in migration:', e.message);
  }
  const agros = [
    [1, 'Soyapango - Puesto'],
    [2, 'Usulután - Puesto'],
    [3, 'Agro Quezaltepeque'],
    [4, 'Agro Aguilares'],
    [5, 'Agro Opico'],
    [6, 'MAG (Gobierno)'],
    [7, 'CNR (Gobierno)'],
    [8, 'Relaciones Exteriores (Gobierno)'],
    [9, 'Lomas de San Francisco']
  ];

  for (const [id, name] of agros) {
    try {
      if (isProduction) {
        await query('INSERT INTO agros (id, name) VALUES (?, ?) ON CONFLICT (id) DO NOTHING', [id, name]);
      } else {
        await query('INSERT OR IGNORE INTO agros (id, name) VALUES (?, ?)', [id, name]);
      }
      await query('UPDATE agros SET name = ? WHERE id = ?', [name, id]);
    } catch (e) {
      console.warn(`Failed to sync agro ${name}:`, e.message);
    }
  }

  // Ensure inventory rows exist for all products — NEVER overwrite existing data
  const products = await query('SELECT id FROM products');
  for (const product of products.rows) {
    if (isProduction) {
      await query(`
        INSERT INTO inventory (product_id, bodega_1, bodega_2, bodega_3, bodega_4, initial_stock, current_stock, sold_stock)
        VALUES (?, 0, 0, 0, 0, 0, 0, 0)
        ON CONFLICT(product_id) DO NOTHING
      `, [product.id]);
    } else {
      await query(`
        INSERT OR IGNORE INTO inventory (product_id, bodega_1, bodega_2, bodega_3, bodega_4, initial_stock, current_stock, sold_stock)
        VALUES (?, 0, 0, 0, 0, 0, 0, 0)
      `, [product.id]);
    }
  }
  // Fix existing tables (SQLite only handles one column at a time)
  const columns = ['current_stock', 'final_stock'];
  for (const col of columns) {
    try {
      await query(`ALTER TABLE inventory ADD COLUMN ${col} DECIMAL(10,2) DEFAULT 0`);
      console.log(`Column ${col} added to inventory`);
    } catch (e) {
      // Column probably already exists
    }
  }

  // Ensure activity_log table exists (migration for existing deployments)
  try {
    await exec(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id ${isProduction ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isProduction ? '' : 'AUTOINCREMENT'},
        role TEXT,
        action TEXT,
        entity TEXT,
        details TEXT,
        product_name TEXT,
        quantity DECIMAL(10,2),
        unit TEXT,
        location TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch(e) {
    console.warn('activity_log migration:', e.message);
  }

  console.log('Database migration completed successfully');
};

// --- INITIALIZATION ---
const initDb = async () => {
  await exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT,
      name TEXT NOT NULL UNIQUE,
      category TEXT,
      price_per_lb DECIMAL(10,2) DEFAULT 0,
      price_per_kg DECIMAL(10,2) DEFAULT 0,
      price_per_box DECIMAL(10,2) DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS agros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS inventory (
      product_id INTEGER PRIMARY KEY,
      bodega_1 DECIMAL(10,2) DEFAULT 0,
      bodega_2 DECIMAL(10,2) DEFAULT 0,
      bodega_3 DECIMAL(10,2) DEFAULT 0,
      bodega_4 DECIMAL(10,2) DEFAULT 0,
      initial_stock DECIMAL(10,2) DEFAULT 0,
      current_stock DECIMAL(10,2) DEFAULT 0,
      sold_stock DECIMAL(10,2) DEFAULT 0,
      final_stock DECIMAL(10,2) DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      origin_warehouse TEXT,
      dest_warehouse TEXT,
      weight DECIMAL(10,2),
      type TEXT,
      date DATE DEFAULT (date('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT,
      action TEXT,
      entity TEXT,
      details TEXT,
      product_name TEXT,
      quantity DECIMAL(10,2),
      unit TEXT,
      location TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS production_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      initial_weight DECIMAL(10,2),
      cut_weight DECIMAL(10,2),
      waste DECIMAL(10,2),
      storage_cost DECIMAL(10,2) DEFAULT 0,
      transport_cost DECIMAL(10,2) DEFAULT 0,
      labor_cost DECIMAL(10,2) DEFAULT 0,
      other_costs DECIMAL(10,2) DEFAULT 0,
      warehouse TEXT DEFAULT 'Bodega 2',
      date DATE DEFAULT (date('now'))
    );

    CREATE TABLE IF NOT EXISTS ransa_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      tag_weight DECIMAL(10,2),
      scale_weight DECIMAL(10,2),
      units_per_box INTEGER,
      unit_type TEXT DEFAULT 'Lbs',
      distribution_details TEXT,
      date DATE DEFAULT (date('now'))
    );

    CREATE TABLE IF NOT EXISTS dispatches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      agro_id INTEGER,
      weight DECIMAL(10,2),
      unit_type TEXT DEFAULT 'Lbs',
      value DECIMAL(10,2),
      date DATE DEFAULT (date('now'))
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agro_id INTEGER,
      amount_received DECIMAL(10,2),
      date DATE DEFAULT (date('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      requested_qty DECIMAL(10,2),
      unit_type TEXT DEFAULT 'Lbs',
      status TEXT DEFAULT 'PENDING',
      date DATE DEFAULT (date('now'))
    );

    CREATE TABLE IF NOT EXISTS food_costing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      event_name TEXT,
      details TEXT, 
      product_id INTEGER,
      gross_weight DECIMAL(10,2),
      gross_cost DECIMAL(10,2),
      cooked_weight DECIMAL(10,2),
      json_data TEXT
    );
  `);

  if (!isProduction) {
    try {
      sqliteDb.prepare('ALTER TABLE products ADD COLUMN code TEXT').run();
    } catch (e) { }
    try {
      sqliteDb.prepare('ALTER TABLE products ADD COLUMN price_per_lb DECIMAL(10,2) DEFAULT 0').run();
    } catch (e) { }
    try {
      sqliteDb.prepare('ALTER TABLE products ADD COLUMN price_per_kg DECIMAL(10,2) DEFAULT 0').run();
    } catch (e) { }
    try {
      sqliteDb.prepare('ALTER TABLE products ADD COLUMN price_per_box DECIMAL(10,2) DEFAULT 0').run();
    } catch (e) { }
    try {
      sqliteDb.prepare('ALTER TABLE inventory ADD COLUMN bodega_1 DECIMAL(10,2) DEFAULT 0').run();
      sqliteDb.prepare('ALTER TABLE inventory ADD COLUMN bodega_2 DECIMAL(10,2) DEFAULT 0').run();
      sqliteDb.prepare('ALTER TABLE inventory ADD COLUMN bodega_3 DECIMAL(10,2) DEFAULT 0').run();
      sqliteDb.prepare('ALTER TABLE inventory ADD COLUMN bodega_4 DECIMAL(10,2) DEFAULT 0').run();
    } catch (e) { }
    try {
      sqliteDb.prepare('ALTER TABLE food_costing ADD COLUMN json_data TEXT').run();
    } catch (e) { }
    try {
      sqliteDb.prepare('ALTER TABLE food_costing ADD COLUMN gross_weight DECIMAL(10,2)').run();
      sqliteDb.prepare('ALTER TABLE food_costing ADD COLUMN gross_cost DECIMAL(10,2)').run();
      sqliteDb.prepare('ALTER TABLE food_costing ADD COLUMN cooked_weight DECIMAL(10,2)').run();
      sqliteDb.prepare('ALTER TABLE food_costing ADD COLUMN product_id INTEGER').run();
    } catch (e) { }
  }

  const products = [
    ['1618', 'Posta Negra / Nalga de Adentro', 'Cortes', 4.25, 9.37, 85.00],
    ['1619', 'Cajas Tortuguita', 'Cortes', 4.65, 10.25, 90.00],
    ['1620', 'HUESO DE YUGO / COGOTE CON HUESO', 'Cortes', 2.00, 4.41, 40.00],
    ['1621', 'NEW YORK / BIEF ANGOSTO', 'Prime', 6.75, 14.88, 130.00],
    ['1622', 'TRIMING 80/20 especial', 'Industrial', 3.10, 6.83, 60.00],
    ['1623', 'cajas de triming 50/50 popular', 'Industrial', 2.75, 6.06, 55.00],
    ['1624', 'cajas de Aguja/chuck', 'Cortes', 4.25, 9.37, 85.00],
    ['1625', 'ANGELINA / CORAZON DE CUADRIL', 'Cortes', 4.75, 10.47, 95.00],
    ['1626', 'CARNE BOVINA CONGELADA SIN HUESO DELANTERO', 'Cortes', 3.95, 8.71, 75.00],
    ['1627', 'CARNE BOVINA CONGELADA SIN HUESO TAPA CUADRIL / PICAÑA', 'Prime', 9.20, 20.28, 180.00],
    ['1628', 'CARNE BOVINA CONGELADA SIN HUESO RECORTE DE CARNE 90 VL premium', 'Industrial', 4.65, 10.25, 90.00]
  ];

  console.log('🔄 Automatizando sincronización de catálogo oficial...');
  for (const p of products) {
    if (isProduction) {
      await query('INSERT INTO products (code, name, category, price_per_lb, price_per_kg, price_per_box) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET price_per_lb = excluded.price_per_lb, price_per_kg = excluded.price_per_kg, price_per_box = excluded.price_per_box, code = excluded.code', p);
    } else {
      try {
        await query('INSERT OR IGNORE INTO products (code, name, category, price_per_lb, price_per_kg, price_per_box) VALUES (?, ?, ?, ?, ?, ?)', p);
        await query('UPDATE products SET price_per_lb = ?, price_per_kg = ?, price_per_box = ?, code = ? WHERE name = ?', [p[3], p[4], p[5], p[0], p[1]]);
      } catch (e) { }
    }
  }

  // Ensure inventory exists for all products — only insert if not exists, NEVER overwrite existing data
  const { rows: prods } = await query('SELECT id FROM products');
  for (const p of prods) {
    if (isProduction) {
      await query(`
        INSERT INTO inventory (product_id, bodega_1, bodega_2, bodega_3, bodega_4, initial_stock, sold_stock) 
        VALUES (?, 0, 0, 0, 0, 0, 0)
        ON CONFLICT(product_id) DO NOTHING
      `, [p.id]);
    } else {
      await query(`
        INSERT OR IGNORE INTO inventory (product_id, bodega_1, bodega_2, bodega_3, bodega_4, initial_stock, sold_stock) 
        VALUES (?, 0, 0, 0, 0, 0, 0)
      `, [p.id]);
    }
    // DO NOT force-update existing inventory — real data must be preserved
  }

  const agros = [
    'Soyapango - Puesto',
    'Usulután - Puesto',
    'Agro Quezaltepeque',
    'Agro Aguilares',
    'Agro Opico',
    'MAG (Gobierno)',
    'CNR (Gobierno)',
    'Relaciones Exteriores (Gobierno)',
    'Lomas de San Francisco'
  ];
  // Sync destinations
  for (const a of agros) {
    if (isProduction) {
      await query('INSERT INTO agros (name) VALUES (?) ON CONFLICT(name) DO NOTHING', [a]);
    } else {
      await query('INSERT OR IGNORE INTO agros (name) VALUES (?)', [a]);
    }
  }
  // Optional: Delete agros not in list to keep it 100% accurate, but only if they are not in use
  const agrosPlaceholders = agros.map(() => '?').join(',');
  try {
    await query(`
      DELETE FROM agros 
      WHERE name NOT IN (${agrosPlaceholders})
      AND id NOT IN (SELECT COALESCE(agro_id, 0) FROM sales)
      AND id NOT IN (SELECT COALESCE(agro_id, 0) FROM dispatches)
    `, agros);
  } catch (e) {
    console.warn('Could not delete some agros due to dependencies:', e.message);
  }

  // Explicitly remove any remaining internal-only names from this table, if not in use
  try {
    await query(`
      DELETE FROM agros 
      WHERE (name LIKE '%Cuarto%' OR name LIKE '%Cuartos%')
      AND id NOT IN (SELECT COALESCE(agro_id, 0) FROM sales)
      AND id NOT IN (SELECT COALESCE(agro_id, 0) FROM dispatches)
    `);
  } catch (e) {
    console.warn('Could not delete internal agros due to dependencies:', e.message);
  }
};

initDb().catch(console.error);

// ─── HELPER: registrar actividad ─────────────────────────────────────────────
async function logActivity({ role = 'sistema', action, entity, details = '', product_name = '', quantity = null, unit = '', location = '' }) {
  try {
    await query(
      `INSERT INTO activity_log (role, action, entity, details, product_name, quantity, unit, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [role, action, entity, details, product_name, quantity, unit, location]
    );
  } catch (e) {
    console.warn('logActivity error:', e.message);
  }
}

// ─── ENDPOINT: obtener log de actividad (solo admin) ─────────────────────────
app.get('/api/admin/activity', async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 200`);
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

// ─── ENDPOINT: eliminar log de actividad ─────────────────────────────────────
app.delete('/api/admin/activity', async (req, res) => {
  try {
    await query('DELETE FROM activity_log');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- API ENDPOINTS ---

app.get('/api/reports/ransa', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT r.*, p.name as product_name 
      FROM ransa_requests r 
      LEFT JOIN products p ON r.product_id = p.id
      ORDER BY r.date DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching ransa logs:', err.message);
    res.json([]);
  }
});

app.delete('/api/reports/ransa/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await query('SELECT * FROM ransa_requests WHERE id = ?', [id]);
    if (rows.length > 0) {
      const log = rows[0];
      const scaleKg = parseFloat(log.scale_weight) || 0;
      const colMap = {
        'Ransa': { col: 'bodega_1', factor: 1 },
        'Lomas de San Francisco': { col: 'bodega_4', factor: 2.20462 },
        'Central de abasto - Soyapango (Cuarto Frío)': { col: 'bodega_2', factor: 2.20462 },
        'Central de abasto - Usulután (Cuarto Frío)': { col: 'bodega_3', factor: 2.20462 }
      };
      const target = colMap[log.distribution_details] || { col: 'bodega_1', factor: 1 };
      const val = scaleKg * target.factor;
      await query(`UPDATE inventory SET ${target.col} = ${target.col} - ? WHERE product_id = ?`, [val, log.product_id]);
      await query('DELETE FROM ransa_requests WHERE id = ?', [id]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/reports/ransa/:id', async (req, res) => {
  const { id } = req.params;
  const { product_id, tag_weight, scale_weight, units_per_box, unit_type, distribution_details } = req.body;
  try {
    const { rows } = await query('SELECT * FROM ransa_requests WHERE id = ?', [id]);
    if (rows.length > 0) {
      const old = rows[0];

      // bodega_1 (Ransa) = KG, bodega_2/3/4 = LBS
      const oldKg = parseFloat(old.scale_weight) || 0;
      const newKg = parseFloat(scale_weight) || 0;
      const unitsPerBox = (units_per_box !== '' && units_per_box != null) ? parseInt(units_per_box) : null;

      const colMap = {
        'Ransa': { col: 'bodega_1', factor: 1 },
        'Lomas de San Francisco': { col: 'bodega_4', factor: 2.20462 },
        'Central de abasto - Soyapango (Cuarto Frío)': { col: 'bodega_2', factor: 2.20462 },
        'Central de abasto - Usulután (Cuarto Frío)': { col: 'bodega_3', factor: 2.20462 }
      };

      // 1. Revert OLD stock
      const oldTarget = colMap[old.distribution_details] || { col: 'bodega_1', factor: 1 };
      const oldVal = oldKg * oldTarget.factor;
      await query(`UPDATE inventory SET ${oldTarget.col} = ${oldTarget.col} - ?, initial_stock = initial_stock - ? WHERE product_id = ?`, [oldVal, oldVal, old.product_id]);

      // 2. Apply NEW stock
      const newTarget = colMap[distribution_details] || { col: 'bodega_1', factor: 1 };
      const newVal = newKg * newTarget.factor;
      await query(`UPDATE inventory SET ${newTarget.col} = ${newTarget.col} + ?, initial_stock = initial_stock + ? WHERE product_id = ?`, [newVal, newVal, product_id]);

      // 3. Update Record
      await query(`
        UPDATE ransa_requests SET product_id = ?, tag_weight = ?, scale_weight = ?, units_per_box = ?, unit_type = ?, distribution_details = ?
        WHERE id = ?
      `, [product_id, parseFloat(tag_weight) || 0, newKg, unitsPerBox, 'Kg', distribution_details, id]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reports/ransa', async (req, res) => {
  const { product_id, tag_weight, scale_weight, units_per_box, unit_type, distribution_details } = req.body;
  try {
    // Ransa always receives in KG. scale_weight is in KG.
    const scaleKg = parseFloat(scale_weight) || 0;
    const tagKg = parseFloat(tag_weight) || 0;
    const scaleLbs = scaleKg * 2.20462; // convert to lbs for non-Ransa bodegas
    const unitsPerBox = (units_per_box !== '' && units_per_box != null) ? parseInt(units_per_box) : null;

    const info = await query(`
      INSERT INTO ransa_requests (product_id, tag_weight, scale_weight, units_per_box, unit_type, distribution_details)
      VALUES (?, ?, ?, ?, ?, ?) RETURNING id
    `, [product_id, tagKg, scaleKg, unitsPerBox, 'Kg', distribution_details]);

    // bodega_1 (Ransa) stores KG. bodega_2/3/4 store LBS.
    const colMap = {
      'Ransa': { col: 'bodega_1', value: scaleKg },
      'Lomas de San Francisco': { col: 'bodega_4', value: scaleLbs },
      'Central de abasto - Soyapango (Cuarto Frío)': { col: 'bodega_2', value: scaleLbs },
      'Central de abasto - Usulután (Cuarto Frío)': { col: 'bodega_3', value: scaleLbs }
    };
    const target = colMap[distribution_details] || { col: 'bodega_1', value: scaleKg };

    await query(`UPDATE inventory SET ${target.col} = ${target.col} + ?, initial_stock = initial_stock + ? WHERE product_id = ?`, [target.value, target.value, product_id]);
    await query('INSERT INTO movements (product_id, origin_warehouse, dest_warehouse, weight, type) VALUES (?, ?, ?, ?, ?)', [product_id, 'Ransa (Origen)', distribution_details, scaleKg, 'INCOME']);

    // Obtener nombre del producto para el log
    const { rows: pRows } = await query('SELECT name FROM products WHERE id = ?', [product_id]);
    const pName = pRows[0]?.name || `Producto #${product_id}`;
    const role = req.headers['x-role'] || 'desconocido';
    await logActivity({ role, action: 'RECEPCIÓN', entity: 'ransa_requests', product_name: pName, quantity: scaleKg, unit: 'KG', location: distribution_details, details: `Viñeta: ${tagKg} kg → Báscula: ${scaleKg} kg → ${distribution_details}` });

    res.json({ id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/dispatches', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT d.*, p.name as product_name, a.name as agro_name 
      FROM dispatches d
      LEFT JOIN products p ON d.product_id = p.id
      LEFT JOIN agros a ON d.agro_id = a.id
      ORDER BY d.date DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching dispatches:', err.message);
    res.json([]);
  }
});

app.post('/api/dispatches', async (req, res) => {
  const { product_id, agro_id, weight, unit_type, value, origin_warehouse } = req.body;
  try {
    const info = await query(`
      INSERT INTO dispatches (product_id, agro_id, weight, unit_type, value)
      VALUES (?, ?, ?, ?, ?) RETURNING id
    `, [product_id, agro_id, weight, unit_type || 'Lbs', value]);

    // Determine which bodega to deduct from based on origin_warehouse
    const colMap = {
      'Ransa': 'bodega_1',
      'Lomas de San Francisco': 'bodega_4',
      'Central de abasto - Soyapango (Cuarto Frío)': 'bodega_2',
      'Soyapango': 'bodega_2',
      'Central de abasto - Usulután (Cuarto Frío)': 'bodega_3',
      'Usulután': 'bodega_3'
    };
    const bodegaCol = colMap[origin_warehouse] || 'bodega_2';

    // bodega_1 (Ransa) is in KG, others in LBS
    let weightInUnits = parseFloat(weight);
    if (bodegaCol === 'bodega_1') {
      // Ransa: convert dispatch weight to KG if it came in Lbs
      if (unit_type === 'Lbs') weightInUnits = weightInUnits / 2.20462;
    } else {
      // Other bodegas: convert to LBS if came in Kg
      if (unit_type === 'Kg') weightInUnits = weightInUnits * 2.20462;
    }

    await query(`UPDATE inventory SET ${bodegaCol} = ${bodegaCol} - ?, sold_stock = sold_stock + ? WHERE product_id = ?`, [weightInUnits, weightInUnits, product_id]);
    await query('INSERT INTO movements (product_id, origin_warehouse, dest_warehouse, weight, type) VALUES (?, ?, ?, ?, ?)', [product_id, origin_warehouse || 'Soyapango', 'Despacho', weight, 'DISPATCH']);

    // Log actividad
    const { rows: pRows2 } = await query('SELECT name FROM products WHERE id = ?', [product_id]);
    const pName2 = pRows2[0]?.name || `Producto #${product_id}`;
    const { rows: aRows } = await query('SELECT name FROM agros WHERE id = ?', [agro_id]);
    const aName = aRows[0]?.name || `Destino #${agro_id}`;
    const role2 = req.headers['x-role'] || 'desconocido';
    await logActivity({ role: role2, action: 'DESPACHO', entity: 'dispatches', product_name: pName2, quantity: parseFloat(weight), unit: unit_type || 'Lbs', location: origin_warehouse || 'Bodega', details: `${weight} ${unit_type} → ${aName} | $${value}` });

    res.json({ id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sales', async (req, res) => {
  const { rows } = await query(`
    SELECT s.*, a.name as agro_name FROM sales s
    JOIN agros a ON s.agro_id = a.id
    ORDER BY date DESC
  `);
  res.json(rows);
});

app.post('/api/sales', async (req, res) => {
  const { agro_id, amount_received } = req.body;
  const info = await query('INSERT INTO sales (agro_id, amount_received) VALUES (?, ?) RETURNING id', [agro_id, amount_received]);
  res.json({ id: info.lastInsertRowid });
});

app.post('/api/inventory/adjust', async (req, res) => {
  const { product_id, current_stock, initial_stock, warehouse } = req.body;
  try {
    const colMap = {
      'Ransa': 'bodega_1',
      'Central de abasto - Soyapango (Cuarto Frío)': 'bodega_2',
      'Central de abasto - Usulután (Cuarto Frío)': 'bodega_3',
      'Lomas de San Francisco': 'bodega_4'
    };
    const targetCol = colMap[warehouse] || 'bodega_1';

    if (initial_stock !== undefined) {
      await query('UPDATE inventory SET initial_stock = ? WHERE product_id = ?', [initial_stock, product_id]);
    }
    if (current_stock !== undefined) {
      await query(`UPDATE inventory SET ${targetCol} = ? WHERE product_id = ?`, [current_stock, product_id]);
    }

    const { rows: pRowsAdj } = await query('SELECT name FROM products WHERE id = ?', [product_id]);
    const pNameAdj = pRowsAdj[0]?.name || `Producto #${product_id}`;
    const unit = (warehouse === 'Ransa') ? 'KG' : 'Lbs';
    await logActivity({ role: req.headers['x-role'] || 'desconocido', action: 'AJUSTE STOCK', entity: 'inventory', product_name: pNameAdj, quantity: current_stock ?? initial_stock, unit, location: warehouse || 'Bodega', details: `Nuevo stock: ${current_stock ?? initial_stock} ${unit} en ${warehouse}` });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/inventory-status', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT p.code, p.name, i.initial_stock, i.sold_stock, i.bodega_1, i.bodega_2, i.bodega_3, i.bodega_4,
             (i.bodega_1 + i.bodega_2 + i.bodega_3 + i.bodega_4) as final_stock
      FROM inventory i
      LEFT JOIN products p ON i.product_id = p.id
      ORDER BY CAST(p.code AS INTEGER) ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching inventory status:', err.message);
    res.json([]);
  }
});

app.get('/api/reports/agro-sales', async (req, res) => {
  const dateFunc = isProduction ? "to_char(s.date, 'YYYY-MM')" : "strftime('%Y-%m', s.date)";
  const { rows } = await query(`
    SELECT a.name as agro_name, 
           SUM(s.amount_received) as total_sales,
           ${dateFunc} as month
    FROM sales s
    JOIN agros a ON s.agro_id = a.id
    GROUP BY a.id, a.name, month
  `);
  res.json(rows);
});

app.get('/api/products', async (req, res) => {
  const { rows } = await query(`
    SELECT p.*, 
           i.bodega_1 as stock_kg,
           i.bodega_4 as stock_b4,
           i.bodega_2 as stock_b2,
           i.bodega_3 as stock_b3
    FROM products p 
    LEFT JOIN inventory i ON p.id = i.product_id 
    ORDER BY CAST(p.code AS INTEGER) ASC
  `);
  res.json(rows);
});

app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { code, name, category, price_per_lb, price_per_kg, price_per_box } = req.body;
  try {
    await query('UPDATE products SET code = ?, name = ?, category = ?, price_per_lb = ?, price_per_kg = ?, price_per_box = ? WHERE id = ?', [code, name, category, price_per_lb, price_per_kg, price_per_box, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/agros', async (req, res) => {
  const { rows } = await query('SELECT * FROM agros');
  res.json(rows);
});

app.post('/api/inventory/transfer', async (req, res) => {
  const { product_id, origin, destination, weight } = req.body;
  try {
    const colMap = {
      'Ransa': 'bodega_1',
      'Central de abasto - Soyapango (Cuarto Frío)': 'bodega_2',
      'Central de abasto - Usulután (Cuarto Frío)': 'bodega_3',
      'Lomas de San Francisco': 'bodega_4'
    };
    const originCol = colMap[origin];
    const destCol = colMap[destination];

    await query(`UPDATE inventory SET ${originCol} = ${originCol} - ? WHERE product_id = ?`, [weight, product_id]);
    await query(`UPDATE inventory SET ${destCol} = ${destCol} + ? WHERE product_id = ?`, [weight, product_id]);

    await query('INSERT INTO movements (product_id, origin_warehouse, dest_warehouse, weight, type) VALUES (?, ?, ?, ?, ?)', [product_id, origin, destination, weight, 'TRANSFER']);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/production/process', async (req, res) => {
  const { product_id, initial_kg, cut_weight, waste, storage_cost, transport_cost, labor_cost, other_costs } = req.body;
  try {
    await query(`
        INSERT INTO production_logs (product_id, initial_weight, cut_weight, waste, storage_cost, transport_cost, labor_cost, other_costs)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [product_id, initial_kg, cut_weight, waste, storage_cost || 0, transport_cost || 0, labor_cost || 0, other_costs || 0]);

    // bodega_1 (Ransa) stores KG → deduct initial_kg in KG
    // bodega_2 (Soyapango) stores LBS → add cut_weight in LBS
    await query('UPDATE inventory SET bodega_1 = bodega_1 - ? WHERE product_id = ?', [initial_kg, product_id]);
    await query('UPDATE inventory SET bodega_2 = bodega_2 + ? WHERE product_id = ?', [cut_weight, product_id]);

    await query('INSERT INTO movements (product_id, origin_warehouse, dest_warehouse, weight, type) VALUES (?, ?, ?, ?, ?)', [product_id, 'Ransa (KG)', 'Soyapango (Lbs)', cut_weight, 'TRANSFER']);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/production/logs', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT l.*, p.name as product_name FROM production_logs l
      LEFT JOIN products p ON l.product_id = p.id
      ORDER BY l.date DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching production logs:', err.message);
    res.json([]);
  }
});

// POST /api/production/logs — usado por el formulario de producción del frontend
app.post('/api/production/logs', async (req, res) => {
  const { product_id, initial_weight, cut_weight, waste, storage_cost, transport_cost, labor_cost, other_costs } = req.body;
  try {
    const initKg = parseFloat(initial_weight) || 0;
    const cutLbs = parseFloat(cut_weight) || 0;
    const wasteVal = parseFloat(waste) || (initKg * 2.20462 - cutLbs);

    await query(`
      INSERT INTO production_logs (product_id, initial_weight, cut_weight, waste, storage_cost, transport_cost, labor_cost, other_costs)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [product_id, initKg, cutLbs, wasteVal, storage_cost || 0, transport_cost || 0, labor_cost || 0, other_costs || 0]);

    // bodega_1 (Ransa) stores KG → deduct initKg
    // bodega_2 (Soyapango) stores LBS → add cutLbs
    await query('UPDATE inventory SET bodega_1 = bodega_1 - ? WHERE product_id = ?', [initKg, product_id]);
    await query('UPDATE inventory SET bodega_2 = bodega_2 + ? WHERE product_id = ?', [cutLbs, product_id]);

    await query('INSERT INTO movements (product_id, origin_warehouse, dest_warehouse, weight, type) VALUES (?, ?, ?, ?, ?)',
      [product_id, 'Ransa (KG)', 'Soyapango (Lbs)', cutLbs, 'TRANSFER']);

    const { rows: pRowsProd } = await query('SELECT name FROM products WHERE id = ?', [product_id]);
    const pNameProd = pRowsProd[0]?.name || `Producto #${product_id}`;
    await logActivity({ role: req.headers['x-role'] || 'desconocido', action: 'PRODUCCIÓN', entity: 'production_logs', product_name: pNameProd, quantity: initKg, unit: 'KG', location: 'Ransa → Soyapango', details: `Entrada: ${initKg} kg | Salida: ${cutLbs} lbs | Merma: ${wasteVal.toFixed(2)} lbs` });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/production/logs/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await query('SELECT * FROM production_logs WHERE id = ?', [id]);
    if (rows.length > 0) {
      const log = rows[0];
      // Revert: restore KG to bodega_1 (Ransa), remove LBS from bodega_2 (Soyapango)
      await query('UPDATE inventory SET bodega_1 = bodega_1 + ? WHERE product_id = ?', [log.initial_weight, log.product_id]);
      await query('UPDATE inventory SET bodega_2 = bodega_2 - ? WHERE product_id = ?', [log.cut_weight, log.product_id]);
      await query('DELETE FROM production_logs WHERE id = ?', [id]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/production/logs/:id', async (req, res) => {
  const { id } = req.params;
  const { initial_weight, cut_weight, waste } = req.body;
  try {
    const { rows } = await query('SELECT * FROM production_logs WHERE id = ?', [id]);
    if (rows.length > 0) {
      const old = rows[0];
      // Revert old: restore KG to bodega_1, remove old LBS from bodega_2
      await query('UPDATE inventory SET bodega_1 = bodega_1 + ? WHERE product_id = ?', [old.initial_weight, old.product_id]);
      await query('UPDATE inventory SET bodega_2 = bodega_2 - ? WHERE product_id = ?', [old.cut_weight, old.product_id]);
      // Apply new: deduct new KG from bodega_1, add new LBS to bodega_2
      await query('UPDATE inventory SET bodega_1 = bodega_1 - ? WHERE product_id = ?', [initial_weight, old.product_id]);
      await query('UPDATE inventory SET bodega_2 = bodega_2 + ? WHERE product_id = ?', [cut_weight, old.product_id]);
      await query('UPDATE production_logs SET initial_weight = ?, cut_weight = ?, waste = ? WHERE id = ?', [initial_weight, cut_weight, waste, id]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/dispatches/:id', async (req, res) => {
  const { id } = req.params;
  const { weight, value } = req.body;
  try {
    const { rows } = await query('SELECT * FROM dispatches WHERE id = ?', [id]);
    if (rows.length > 0) {
      const old = rows[0];

      // Map agro_id to bodega column
      const agroToBodegaMap = {
        1: 'bodega_1', // Ransa
        2: 'bodega_2', // Soyapango
        3: 'bodega_3', // Usulután
        4: 'bodega_4'  // Lomas de San Francisco
      };
      const bodegaCol = agroToBodegaMap[old.agro_id] || 'bodega_1';

      // Convert weights to lbs for inventory
      let oldWeightInLbs = parseFloat(old.weight);
      let newWeightInLbs = parseFloat(weight);

      if (old.unit_type === 'Kg') {
        oldWeightInLbs = oldWeightInLbs * 2.20462;
      }
      // For new weight, we need to get the unit_type from the old record since it's not passed in PUT
      if (old.unit_type === 'Kg') {
        newWeightInLbs = newWeightInLbs * 2.20462;
      }

      // Diff reversal - add back old weight, subtract new weight
      await query(`UPDATE inventory SET ${bodegaCol} = ${bodegaCol} + ?, sold_stock = sold_stock - ? WHERE product_id = ?`, [oldWeightInLbs, oldWeightInLbs, old.product_id]);
      await query(`UPDATE inventory SET ${bodegaCol} = ${bodegaCol} - ?, sold_stock = sold_stock + ? WHERE product_id = ?`, [newWeightInLbs, newWeightInLbs, old.product_id]);
      await query('UPDATE dispatches SET weight = ?, value = ? WHERE id = ?', [weight, value, id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/dispatches/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await query('SELECT * FROM dispatches WHERE id = ?', [id]);
    if (rows.length > 0) {
      const log = rows[0];

      // Map agro_id to bodega column
      const agroToBodegaMap = {
        1: 'bodega_1', // Ransa
        2: 'bodega_2', // Soyapango
        3: 'bodega_3', // Usulután
        4: 'bodega_4'  // Lomas de San Francisco
      };
      const bodegaCol = agroToBodegaMap[log.agro_id] || 'bodega_1';

      // Convert weight to lbs for inventory
      let weightInLbs = parseFloat(log.weight);
      if (log.unit_type === 'Kg') {
        weightInLbs = weightInLbs * 2.20462;
      }

      // Revert: Add back to the correct bodega
      await query(`UPDATE inventory SET ${bodegaCol} = ${bodegaCol} + ?, sold_stock = sold_stock - ? WHERE product_id = ?`, [weightInLbs, weightInLbs, log.product_id]);
      await query('DELETE FROM dispatches WHERE id = ?', [id]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/orders', async (req, res) => {
  const { product_id, requested_qty } = req.body;
  const info = await query('INSERT INTO orders (product_id, requested_qty) VALUES (?, ?) RETURNING id', [product_id, requested_qty]);
  res.json({ id: info.lastInsertRowid });
});

app.get('/api/orders', async (req, res) => {
  const { rows } = await query('SELECT o.*, p.name as product_name FROM orders o JOIN products p ON o.product_id = p.id');
  res.json(rows);
});

app.get('/api/food-costing', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT * FROM food_costing 
      ORDER BY date DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching food costing:', err.message);
    res.json([]);
  }
});

app.post('/api/food-costing', async (req, res) => {
  const { product_id, gross_weight, gross_cost, cooked_weight, json_data } = req.body;
  try {
    // Use different queries for SQLite vs PostgreSQL
    let info;
    if (isProduction) {
      // PostgreSQL supports RETURNING
      info = await query(`
        INSERT INTO food_costing (product_id, gross_weight, gross_cost, cooked_weight, json_data, date)
        VALUES (?, ?, ?, ?, ?, ?) RETURNING id
      `, [product_id, gross_weight, gross_cost, cooked_weight, json_data, new Date().toISOString()]);
    } else {
      // SQLite: insert then get last ID
      const insertStmt = sqliteDb.prepare(`
        INSERT INTO food_costing (product_id, gross_weight, gross_cost, cooked_weight, json_data, date)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const result = insertStmt.run(product_id, gross_weight, gross_cost, cooked_weight, json_data, new Date().toISOString());
      info = { lastInsertRowid: result.lastInsertRowid, rows: [] };
    }

    // Parse json_data for better log details
    let eventName = 'Lote de comida';
    try {
      const parsed = typeof json_data === 'string' ? JSON.parse(json_data) : json_data;
      if (parsed?.event_name) eventName = parsed.event_name;
    } catch(e) {}
    await logActivity({ role: req.headers['x-role'] || 'desconocido', action: 'LOTE COMIDA', entity: 'food_costing', product_name: eventName, quantity: parseFloat(gross_weight) || 0, unit: 'Lbs', location: 'Lomas', details: `Costo: $${gross_cost} | Balance: $${cooked_weight}` });

    // Return ID from lastInsertRowid or from rows[0].id as fallback
    const returnedId = info.lastInsertRowid || (info.rows && info.rows[0] && info.rows[0].id) || null;
    console.log('Food costing saved with ID:', returnedId);
    res.json({ id: returnedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/food-costing-all', async (req, res) => {
  try {
    await query('DELETE FROM food_costing');
    res.json({ success: true, message: 'Historial de lotes eliminado correctamente' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/food-costing/:id', async (req, res) => {
  const { id } = req.params;
  const { gross_weight, gross_cost, cooked_weight, json_data } = req.body;
  try {
    await query(`
      UPDATE food_costing 
      SET gross_weight = ?, gross_cost = ?, cooked_weight = ?, json_data = ?
      WHERE id = ?
    `, [gross_weight, gross_cost, cooked_weight, json_data, id]);
    
    // Log the update activity
    const details = JSON.parse(json_data);
    const eventName = details.event_name || 'Evento desconocido';
    await logActivity({ 
      role: req.headers['x-role'] || 'desconocido', 
      action: 'LOTE COMIDA', 
      entity: 'food_costing', 
      product_name: eventName, 
      quantity: parseFloat(gross_weight) || 0, 
      unit: 'Lbs', 
      location: 'Lomas', 
      details: `Actualizado: Costo: $${gross_cost} | Balance: $${cooked_weight}` 
    });

    res.json({ success: true, message: 'Registro actualizado correctamente' });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

app.delete('/api/food-costing/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM food_costing WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/sync-catalog', async (req, res) => {
  try {
    const products = [
      ['1618', 'Posta Negra / Nalga de Adentro', 'Cortes', 4.25],
      ['1619', 'Cajas Tortuguita', 'Cortes', 4.65],
      ['1620', 'HUESO DE YUGO / COGOTE CON HUESO', 'Cortes', 2.00],
      ['1621', 'NEW YORK / BIEF ANGOSTO', 'Prime', 6.75],
      ['1622', 'TRIMING 80/20 especial', 'Industrial', 3.10],
      ['1623', 'cajas de triming 50/50 popular', 'Industrial', 2.75],
      ['1624', 'cajas de Aguja/chuck', 'Cortes', 4.25],
      ['1625', 'ANGELINA / CORAZON DE CUADRIL', 'Cortes', 4.75],
      ['1626', 'CARNE BOVINA CONGELADA SIN HUESO DELANTERO', 'Cortes', 3.95],
      ['1627', 'CARNE BOVINA CONGELADA SIN HUESO TAPA CUADRIL / PICAÑA', 'Prime', 9.20],
      ['1628', 'CARNE BOVINA CONGELADA SIN HUESO RECORTE DE CARNE 90 VL premium', 'Industrial', 4.65]
    ];

    // Delete records in reverse dependency order to avoid FK errors
    await query('DELETE FROM inventory');
    await query('DELETE FROM ransa_requests');
    await query('DELETE FROM dispatches');
    await query('DELETE FROM orders');
    await query('DELETE FROM products');

    // Re-insert exactly as image
    for (const p of products) {
      await query('INSERT INTO products (code, name, category, price_per_lb) VALUES (?, ?, ?, ?)', p);
    }
    // Ensure inventory exists for new products
    const { rows: prods } = await query('SELECT id FROM products');
    for (const p of prods) {
      await query('INSERT INTO inventory (product_id, initial_stock, current_stock) VALUES (?, 100, 100)');
    }

    res.json({ success: true, message: 'Catálogo sincronizado con la imagen' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/clear-inventory', async (req, res) => {
  try {
    await query('UPDATE inventory SET bodega_1 = 0, bodega_2 = 0, bodega_3 = 0, bodega_4 = 0, current_stock = 0, sold_stock = 0');
    await query('DELETE FROM movements');
    await query('DELETE FROM production_logs');
    await query('DELETE FROM dispatches');
    await query('DELETE FROM ransa_requests');
    res.json({ success: true, message: 'Inventario vaciado completamente' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/reset', async (req, res) => {
  try {
    await query('DELETE FROM ransa_requests');
    await query('DELETE FROM dispatches');
    await query('DELETE FROM sales');
    await query('DELETE FROM orders');
    await query('UPDATE inventory SET initial_stock = 100, current_stock = 100, sold_stock = 0');
    res.json({ success: true, message: 'Base de datos reiniciada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

// Initialize database and run migration
initDb().then(() => {
  migrateDatabase().then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server running at port ${port}`);
      console.log('All changes applied: New locations, stock levels (100 per bodega), and deduction logic');
    });
  }).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}).catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
