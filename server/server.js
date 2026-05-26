import express from 'express';
// import Database from 'better-sqlite3'; // Moved to dynamic import for production optimization

import cors from 'cors';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { resolve4 } from 'dns/promises';
import { setDefaultResultOrder } from 'dns';
import pkg from 'pg';
const { Pool } = pkg;

// Force IPv4 DNS resolution globally before any network operations
setDefaultResultOrder('ipv4first');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000; // Auto-deploy: GitHub Actions + watch-deploy + post-commit hook

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

// Version endpoint for auto-refresh
app.get('/api/version', (req, res) => {
  const version = process.env.RENDER_GIT_COMMIT || Date.now().toString();
  res.send(version);
});

// Health check for Render (render.yaml healthCheckPath: /api)
app.get('/api', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// --- DATABASE CONFIGURATION ---
// Auto-detect: PostgreSQL if DATABASE_URL is set, else SQLite
const isProduction = !!process.env.DATABASE_URL;
let pool;
let sqliteDb;

if (isProduction) {
  console.log('🌐 Conectando a PostgreSQL (Producción)...');
  
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      family: 4, // Force IPv4
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000
    });
    
    // Test the connection
    const client = await pool.connect();
    console.log('✅ PostgreSQL conectado exitosamente');
    client.release();
  } catch (e) {
    console.error('❌ Error conectando PostgreSQL:', e.message);
    console.log('⚠️ Fallback a SQLite...');
    pool = null;
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
  if (pool) {
    // Convert ? to $1, $2, etc for PostgreSQL
    let index = 1;
    const pgSqlFixed = sql.replace(/\?/g, () => `$${index++}`);
    const res = await pool.query(pgSqlFixed, params);
    return {
      rows: res.rows,
      lastInsertRowid: res.rows[0]?.id || null
    };
  } else if (sqliteDb) {
    const stmt = sqliteDb.prepare(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return { rows: stmt.all(...params) };
    } else {
      const info = stmt.run(...params);
      return { lastInsertRowid: info.lastInsertRowid, rows: [] };
    }
  } else {
    console.warn('⚠️ Query intentada sin conexión a base de datos.');
    return { rows: [], lastInsertRowid: null };
  }
}

// Execute multiple SQL updates atomically in a transaction
async function runTransaction(updates) {
  if (updates.length === 0) return;
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const u of updates) {
        let index = 1;
        const pgSql = u.sql.replace(/\?/g, () => `$${index++}`);
        await client.query(pgSql, u.params);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } else if (sqliteDb) {
    const txn = sqliteDb.transaction(() => {
      for (const u of updates) {
        sqliteDb.prepare(u.sql).run(...u.params);
      }
    });
    txn();
  }
}

// Validate numeric input, returns parsed float or throws
function sanitizeNumber(val, fieldName, allowZero = true) {
  const n = parseFloat(val);
  if (isNaN(n)) throw new Error(`El campo '${fieldName}' debe ser un número válido`);
  if (!allowZero && n <= 0) throw new Error(`El campo '${fieldName}' debe ser mayor que 0`);
  return n;
}

// Validate that required fields are present
function validateRequired(body, fields) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || body[f] === '') {
      throw new Error(`El campo '${f}' es requerido`);
    }
  }
}

// Create a timestamped backup of the SQLite database
async function backupDatabase() {
  if (!sqliteDb) return;
  try {
    const src = join(__dirname, '../inventario_oficial.db');
    const backupDir = join(__dirname, '../backups');
    await fs.mkdir(backupDir, { recursive: true });
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    const dst = join(backupDir, `inventario_${stamp}.db`);
    await fs.cp(src, dst);
    console.log(`[BACKUP] Database backed up to ${dst}`);
    // Keep only last 10 backups
    const files = (await fs.readdir(backupDir)).filter(f => f.startsWith('inventario_')).sort().reverse();
    for (const oldFile of files.slice(10)) {
      await fs.rm(join(backupDir, oldFile), { force: true });
    }
  } catch (e) {
    console.warn('[BACKUP] Error:', e.message);
  }
}

async function exec(sql) {
  if (pool) {
    const adapted = sql
      .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
      .replace(/strftime\('%Y-%m', s.date\)/gi, "to_char(s.date, 'YYYY-MM')");
    const statements = adapted.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      await pool.query(stmt);
    }
  } else if (sqliteDb) {
    return sqliteDb.exec(sql);
  } else {
    console.warn('⚠️ Exec intentada sin conexión a base de datos.');
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
        if (pool) {
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
    if (pool) {
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
        id ${pool ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${pool ? '' : 'AUTOINCREMENT'},
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

  // Add discount_percent column to dispatches if not exists
  try {
    if (pool) {
      await query(`ALTER TABLE dispatches ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0`);
    } else if (sqliteDb) {
      sqliteDb.prepare('ALTER TABLE dispatches ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0').run();
    }
    console.log('discount_percent column added to dispatches');
  } catch(e) {
    console.log('discount_percent column already exists in dispatches');
  }

  // Add cajas column to inventory if not exists
  try {
    if (pool) {
      await query(`ALTER TABLE inventory ADD COLUMN cajas DECIMAL(10,2) DEFAULT 0`);
    } else if (sqliteDb) {
      sqliteDb.prepare('ALTER TABLE inventory ADD COLUMN cajas DECIMAL(10,2) DEFAULT 0').run();
    }
    console.log('cajas column added to inventory');
  } catch(e) {
    console.log('cajas column already exists in inventory');
  }

  // Add entradas_cajas and salidas_cajas columns to inventory if not exists
  try {
    if (pool) {
      await query(`ALTER TABLE inventory ADD COLUMN entradas_cajas DECIMAL(10,2) DEFAULT 0`);
      await query(`ALTER TABLE inventory ADD COLUMN salidas_cajas DECIMAL(10,2) DEFAULT 0`);
    } else {
      sqliteDb.prepare('ALTER TABLE inventory ADD COLUMN entradas_cajas DECIMAL(10,2) DEFAULT 0').run();
      sqliteDb.prepare('ALTER TABLE inventory ADD COLUMN salidas_cajas DECIMAL(10,2) DEFAULT 0').run();
    }
    console.log('entradas_cajas and salidas_cajas columns added to inventory');
  } catch(e) {
    console.log('entradas_cajas/salidas_cajas columns already exist in inventory');
  }

  console.log('Database migration completed successfully');

  // Add origin_weight and dest_weight to movements if not exists
  try {
    if (pool) {
      await query(`ALTER TABLE movements ADD COLUMN origin_weight DECIMAL(10,2) DEFAULT 0`);
      await query(`ALTER TABLE movements ADD COLUMN dest_weight DECIMAL(10,2) DEFAULT 0`);
    } else if (sqliteDb) {
      sqliteDb.prepare('ALTER TABLE movements ADD COLUMN origin_weight DECIMAL(10,2) DEFAULT 0').run();
      sqliteDb.prepare('ALTER TABLE movements ADD COLUMN dest_weight DECIMAL(10,2) DEFAULT 0').run();
    }
    console.log('origin_weight/dest_weight columns added to movements');
  } catch(e) {
    console.log('origin_weight/dest_weight columns already exist in movements');
  }

  // Add unit_type to movements if not exists
  try {
    if (pool) {
      await query(`ALTER TABLE movements ADD COLUMN unit_type TEXT DEFAULT 'Lbs'`);
    } else if (sqliteDb) {
      sqliteDb.prepare("ALTER TABLE movements ADD COLUMN unit_type TEXT DEFAULT 'Lbs'").run();
    }
    console.log('unit_type column added to movements');
  } catch(e) {
    console.log('unit_type column already exists in movements');
  }

  // Add dest_warehouse column to production_logs if not exists
  try {
    if (pool) {
      await query(`ALTER TABLE production_logs ADD COLUMN dest_warehouse TEXT DEFAULT ''`);
    } else if (sqliteDb) {
      sqliteDb.prepare("ALTER TABLE production_logs ADD COLUMN dest_warehouse TEXT DEFAULT ''").run();
    }
    console.log('dest_warehouse column added to production_logs');
  } catch(e) {
    console.log('dest_warehouse column already exists in production_logs');
  }
};

// --- INITIALIZATION ---
const initDb = async () => {
  const idType = pool ? 'SERIAL' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const dateDefault = pool ? 'CURRENT_DATE' : "(date('now'))";

  await exec(`
    CREATE TABLE IF NOT EXISTS products (
      id ${idType},
      code TEXT,
      name TEXT NOT NULL UNIQUE,
      category TEXT,
      price_per_lb DECIMAL(10,2) DEFAULT 0,
      price_per_kg DECIMAL(10,2) DEFAULT 0,
      price_per_box DECIMAL(10,2) DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS agros (
      id ${idType},
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
      id ${idType},
      product_id INTEGER,
      origin_warehouse TEXT,
      dest_warehouse TEXT,
      weight DECIMAL(10,2),
      type TEXT,
      date DATE DEFAULT ${dateDefault}
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id ${idType},
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
      id ${idType},
      product_id INTEGER,
      initial_weight DECIMAL(10,2),
      cut_weight DECIMAL(10,2),
      waste DECIMAL(10,2),
      storage_cost DECIMAL(10,2) DEFAULT 0,
      transport_cost DECIMAL(10,2) DEFAULT 0,
      labor_cost DECIMAL(10,2) DEFAULT 0,
      other_costs DECIMAL(10,2) DEFAULT 0,
      warehouse TEXT DEFAULT 'Bodega 2',
      date DATE DEFAULT ${dateDefault}
    );

    CREATE TABLE IF NOT EXISTS ransa_requests (
      id ${idType},
      product_id INTEGER,
      tag_weight DECIMAL(10,2),
      scale_weight DECIMAL(10,2),
      units_per_box INTEGER,
      unit_type TEXT DEFAULT 'Lbs',
      distribution_details TEXT,
      date DATE DEFAULT ${dateDefault}
    );

    CREATE TABLE IF NOT EXISTS dispatches (
      id ${idType},
      product_id INTEGER,
      agro_id INTEGER,
      weight DECIMAL(10,2),
      unit_type TEXT DEFAULT 'Lbs',
      value DECIMAL(10,2),
      date DATE DEFAULT ${dateDefault}
    );

    CREATE TABLE IF NOT EXISTS sales (
      id ${idType},
      agro_id INTEGER,
      amount_received DECIMAL(10,2),
      date DATE DEFAULT ${dateDefault}
    );

    CREATE TABLE IF NOT EXISTS orders (
      id ${idType},
      product_id INTEGER,
      requested_qty DECIMAL(10,2),
      unit_type TEXT DEFAULT 'Lbs',
      status TEXT DEFAULT 'PENDING',
      date DATE DEFAULT ${dateDefault}
    );

    CREATE TABLE IF NOT EXISTS food_costing (
      id ${idType},
      date TEXT,
      event_name TEXT,
      details TEXT, 
      product_id INTEGER,
      gross_weight DECIMAL(10,2),
      gross_cost DECIMAL(10,2),
      cooked_weight DECIMAL(10,2),
      json_data TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id ${idType},
      product_id INTEGER,
      warehouse TEXT,
      bodega_col TEXT,
      weight_change DECIMAL(10,2) DEFAULT 0,
      cajas_change INTEGER DEFAULT 0,
      role TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (sqliteDb) {
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
    if (pool) {
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
    if (pool) {
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
    if (pool) {
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
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
    const offset = (page - 1) * limit;
    const { rows: countRows } = await query('SELECT COUNT(*) as total FROM activity_log');
    const total = countRows[0]?.total || 0;
    const { rows } = await query(`SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset]);
    res.json({ rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.json({ rows: [], total: 0, page: 1, limit: 100, pages: 0 });
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
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
    const offset = (page - 1) * limit;
    const { rows: countRows } = await query('SELECT COUNT(*) as total FROM ransa_requests');
    const total = countRows[0]?.total || 0;
    const { rows } = await query(`
      SELECT r.*, p.name as product_name 
      FROM ransa_requests r 
      LEFT JOIN products p ON r.product_id = p.id
      ORDER BY r.date DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    res.json({ rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Error fetching ransa logs:', err.message);
    res.json({ rows: [], total: 0, page: 1, limit: 100, pages: 0 });
  }
});

app.delete('/api/reports/ransa/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await query('SELECT * FROM ransa_requests WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Recepción no encontrada' });
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

    // Verify there's enough stock in destination to remove
    if (target.col !== 'bodega_1') {
      const { rows: check } = await query(`SELECT ${target.col} FROM inventory WHERE product_id = ?`, [log.product_id]);
      const current = parseFloat(check[0]?.[target.col]) || 0;
      if (current < val) {
        return res.status(400).json({ error: `Stock insuficiente en destino para revertir: tiene ${current.toFixed(2)} lbs, necesita ${val.toFixed(2)} lbs` });
      }
    }

    await runTransaction([
      ...(target.col !== 'bodega_1'
        ? [{ sql: `UPDATE inventory SET bodega_1 = bodega_1 + ?, ${target.col} = ${target.col} - ?, initial_stock = initial_stock - ? WHERE product_id = ?`, params: [scaleKg, val, val, log.product_id] }]
        : [{ sql: `UPDATE inventory SET ${target.col} = ${target.col} - ?, initial_stock = initial_stock - ? WHERE product_id = ?`, params: [val, val, log.product_id] }]),
      { sql: 'DELETE FROM ransa_requests WHERE id = ?', params: [id] }
    ]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/reports/ransa/:id', async (req, res) => {
  const { id } = req.params;
  const { product_id, tag_weight, scale_weight, units_per_box, distribution_details } = req.body;
  try {
    validateRequired(req.body, ['product_id', 'scale_weight', 'distribution_details']);
    const { rows } = await query('SELECT * FROM ransa_requests WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Recepción no encontrada' });
    const old = rows[0];

    const oldKg = parseFloat(old.scale_weight) || 0;
    const newKg = sanitizeNumber(scale_weight, 'scale_weight', false);
    const tagKg = sanitizeNumber(tag_weight, 'tag_weight');
    const unitsPerBox = (units_per_box !== '' && units_per_box != null) ? parseInt(units_per_box) : null;

    const colMap = {
      'Ransa': { col: 'bodega_1', factor: 1 },
      'Lomas de San Francisco': { col: 'bodega_4', factor: 2.20462 },
      'Central de abasto - Soyapango (Cuarto Frío)': { col: 'bodega_2', factor: 2.20462 },
      'Central de abasto - Usulután (Cuarto Frío)': { col: 'bodega_3', factor: 2.20462 }
    };

    const oldTarget = colMap[old.distribution_details] || { col: 'bodega_1', factor: 1 };
    const oldVal = oldKg * oldTarget.factor;
    const newTarget = colMap[distribution_details] || { col: 'bodega_1', factor: 1 };
    const newVal = newKg * newTarget.factor;

    // Verify sufficient stock before reverting
    if (oldTarget.col !== 'bodega_1') {
      const { rows: check } = await query(`SELECT ${oldTarget.col} FROM inventory WHERE product_id = ?`, [old.product_id]);
      const current = parseFloat(check[0]?.[oldTarget.col]) || 0;
      if (current < oldVal) {
        return res.status(400).json({ error: `Stock insuficiente en destino para editar: tiene ${current.toFixed(2)} lbs, necesita ${oldVal.toFixed(2)} lbs` });
      }
    }
    if (newTarget.col !== 'bodega_1') {
      const { rows: check } = await query('SELECT bodega_1 FROM inventory WHERE product_id = ?', [product_id]);
      const current = parseFloat(check[0]?.bodega_1) || 0;
      if (current + oldKg < newKg) {
        return res.status(400).json({ error: `Stock insuficiente en Ransa para la nueva distribución: necesita ${newKg.toFixed(2)} kg` });
      }
    }

    const updates = [];
    // 1. Revert OLD
    if (oldTarget.col !== 'bodega_1') {
      updates.push({ sql: `UPDATE inventory SET bodega_1 = bodega_1 + ?, ${oldTarget.col} = ${oldTarget.col} - ?, initial_stock = initial_stock - ? WHERE product_id = ?`, params: [oldKg, oldVal, oldVal, old.product_id] });
    } else {
      updates.push({ sql: `UPDATE inventory SET ${oldTarget.col} = ${oldTarget.col} - ?, initial_stock = initial_stock - ? WHERE product_id = ?`, params: [oldVal, oldVal, old.product_id] });
    }
    // 2. Apply NEW
    if (newTarget.col !== 'bodega_1') {
      updates.push({ sql: `UPDATE inventory SET bodega_1 = bodega_1 - ?, ${newTarget.col} = ${newTarget.col} + ?, initial_stock = initial_stock + ? WHERE product_id = ?`, params: [newKg, newVal, newVal, product_id] });
    } else {
      updates.push({ sql: `UPDATE inventory SET ${newTarget.col} = ${newTarget.col} + ?, initial_stock = initial_stock + ? WHERE product_id = ?`, params: [newVal, newVal, product_id] });
    }
    // 3. Update record
    updates.push({ sql: 'UPDATE ransa_requests SET product_id = ?, tag_weight = ?, scale_weight = ?, units_per_box = ?, unit_type = ?, distribution_details = ? WHERE id = ?', params: [product_id, tagKg, newKg, unitsPerBox, 'Kg', distribution_details, id] });

    await runTransaction(updates);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reports/ransa', async (req, res) => {
  const { product_id, tag_weight, scale_weight, units_per_box, cajas, unit_type, distribution_details } = req.body;
  try {
    validateRequired(req.body, ['product_id', 'scale_weight', 'distribution_details']);
    const scaleKg = sanitizeNumber(scale_weight, 'scale_weight', false);
    const tagKg = sanitizeNumber(tag_weight, 'tag_weight');
    const boxCount = parseInt(cajas) || 0;
    const scaleLbs = scaleKg * 2.20462;
    const unitsPerBox = (units_per_box !== '' && units_per_box != null) ? parseInt(units_per_box) : null;

    const colMap = {
      'Ransa': { col: 'bodega_1', value: scaleKg },
      'Lomas de San Francisco': { col: 'bodega_4', value: scaleLbs },
      'Central de abasto - Soyapango (Cuarto Frío)': { col: 'bodega_2', value: scaleLbs },
      'Central de abasto - Usulután (Cuarto Frío)': { col: 'bodega_3', value: scaleLbs }
    };
    const target = colMap[distribution_details] || { col: 'bodega_1', value: scaleKg };

    // Verify sufficient stock in Ransa if distributing elsewhere
    if (target.col !== 'bodega_1') {
      const { rows: check } = await query('SELECT bodega_1 FROM inventory WHERE product_id = ?', [product_id]);
      const current = parseFloat(check[0]?.bodega_1) || 0;
      if (current < scaleKg) {
        return res.status(400).json({ error: `Stock insuficiente en Ransa: tiene ${current.toFixed(2)} kg, necesita ${scaleKg.toFixed(2)} kg` });
      }
    }

    const info = await query(`
      INSERT INTO ransa_requests (product_id, tag_weight, scale_weight, units_per_box, unit_type, distribution_details)
      VALUES (?, ?, ?, ?, ?, ?) RETURNING id
    `, [product_id, tagKg, scaleKg, unitsPerBox, 'Kg', distribution_details]);

    await runTransaction([
      { sql: `UPDATE inventory SET ${target.col} = ${target.col} + ?, initial_stock = initial_stock + ?, entradas_cajas = entradas_cajas + ? WHERE product_id = ?`, params: [target.value, target.value, boxCount, product_id] },
      ...(target.col !== 'bodega_1' ? [{ sql: 'UPDATE inventory SET bodega_1 = bodega_1 - ? WHERE product_id = ?', params: [scaleKg, product_id] }] : []),
      { sql: 'INSERT INTO movements (product_id, origin_warehouse, dest_warehouse, weight, type) VALUES (?, ?, ?, ?, ?)', params: [product_id, 'Ransa (Origen)', distribution_details, scaleKg, 'INCOME'] }
    ]);

    const { rows: pRows } = await query('SELECT name FROM products WHERE id = ?', [product_id]);
    const pName = pRows[0]?.name || `Producto #${product_id}`;
    const role = req.headers['x-role'] || 'desconocido';
    const details = boxCount > 0 ? `Viñeta: ${tagKg} kg → Báscula: ${scaleKg} kg → ${distribution_details} | Cajas: ${boxCount}` : `Viñeta: ${tagKg} kg → Báscula: ${scaleKg} kg → ${distribution_details}`;
    await logActivity({ role, action: 'RECEPCIÓN', entity: 'ransa_requests', product_name: pName, quantity: scaleKg, unit: 'KG', location: distribution_details, details });

    res.json({ id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/dispatches', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
    const offset = (page - 1) * limit;
    const { rows: countRows } = await query('SELECT COUNT(*) as total FROM dispatches');
    const total = countRows[0]?.total || 0;
    const { rows } = await query(`
      SELECT d.*, p.name as product_name, a.name as agro_name 
      FROM dispatches d
      LEFT JOIN products p ON d.product_id = p.id
      LEFT JOIN agros a ON d.agro_id = a.id
      ORDER BY d.date DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    res.json({ rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Error fetching dispatches:', err.message);
    res.json({ rows: [], total: 0, page: 1, limit: 100, pages: 0 });
  }
});

app.post('/api/dispatches', async (req, res) => {
  const { product_id, agro_id, weight, unit_type, value, origin_warehouse, discount_percent, cajas } = req.body;
  try {
    validateRequired(req.body, ['product_id', 'weight', 'value']);
    const weightVal = sanitizeNumber(weight, 'weight', false);
    const valueVal = sanitizeNumber(value, 'value', false);

    const colMap = {
      'Ransa': 'bodega_1',
      'Lomas de San Francisco': 'bodega_4',
      'Central de abasto - Soyapango (Cuarto Frío)': 'bodega_2',
      'Soyapango': 'bodega_2',
      'Central de abasto - Usulután (Cuarto Frío)': 'bodega_3',
      'Usulután': 'bodega_3'
    };
    const bodegaCol = colMap[origin_warehouse] || 'bodega_2';

    let weightInUnits = weightVal;
    let updates = [];

    if (unit_type === 'Cajas') {
      const boxCount = parseInt(weight) || 0;
      if (boxCount > 0) {
        updates.push({ sql: 'UPDATE inventory SET salidas_cajas = salidas_cajas + ? WHERE product_id = ?', params: [boxCount, product_id] });
      }
    } else {
      if (bodegaCol === 'bodega_1') {
        if (unit_type === 'Lbs') weightInUnits = weightInUnits / 2.20462;
      } else {
        if (unit_type === 'Kg') weightInUnits = weightInUnits * 2.20462;
      }

      // Verify sufficient stock
      const { rows: check } = await query(`SELECT ${bodegaCol} FROM inventory WHERE product_id = ?`, [product_id]);
      const current = parseFloat(check[0]?.[bodegaCol]) || 0;
      if (current < weightInUnits) {
        const unitLabel = bodegaCol === 'bodega_1' ? 'kg' : 'lbs';
        return res.status(400).json({ error: `Stock insuficiente en ${origin_warehouse || 'bodega'}: tiene ${current.toFixed(2)} ${unitLabel}, necesita ${weightInUnits.toFixed(2)} ${unitLabel}` });
      }

      updates.push({ sql: `UPDATE inventory SET ${bodegaCol} = ${bodegaCol} - ?, sold_stock = sold_stock + ? WHERE product_id = ?`, params: [weightInUnits, weightInUnits, product_id] });

      const boxCount = parseInt(cajas) || 0;
      if (boxCount > 0) {
        updates.push({ sql: 'UPDATE inventory SET salidas_cajas = salidas_cajas + ? WHERE product_id = ?', params: [boxCount, product_id] });
      }
    }

    updates.push({ sql: 'INSERT INTO movements (product_id, origin_warehouse, dest_warehouse, weight, type) VALUES (?, ?, ?, ?, ?)', params: [product_id, origin_warehouse || 'Soyapango', 'Despacho', weight, 'DISPATCH'] });

    const info = await query(`
      INSERT INTO dispatches (product_id, agro_id, weight, unit_type, value, discount_percent)
      VALUES (?, ?, ?, ?, ?, ?) RETURNING id
    `, [product_id, agro_id, weight, unit_type || 'Lbs', valueVal, discount_percent || 0]);

    await runTransaction(updates);

    const { rows: pRows2 } = await query('SELECT name FROM products WHERE id = ?', [product_id]);
    const pName2 = pRows2[0]?.name || `Producto #${product_id}`;
    const { rows: aRows } = await query('SELECT name FROM agros WHERE id = ?', [agro_id]);
    const aName = aRows[0]?.name || `Destino #${agro_id}`;
    const role2 = req.headers['x-role'] || 'desconocido';
    await logActivity({ role: role2, action: 'DESPACHO', entity: 'dispatches', product_name: pName2, quantity: weightVal, unit: unit_type || 'Lbs', location: origin_warehouse || 'Bodega', details: `${weight} ${unit_type} → ${aName} | $${valueVal}` });

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
  const { product_id, current_stock, initial_stock, cajas, warehouse, mode } = req.body;
  try {
    validateRequired(req.body, ['product_id']);
    const colMap = {
      'Ransa': { col: 'bodega_1', unit: 'KG' },
      'Central de abasto - Soyapango (Cuarto Frío)': { col: 'bodega_2', unit: 'Lbs' },
      'Central de abasto - Usulután (Cuarto Frío)': { col: 'bodega_3', unit: 'Lbs' },
      'Lomas de San Francisco': { col: 'bodega_4', unit: 'Lbs' }
    };
    const target = colMap[warehouse] || { col: 'bodega_1', unit: 'KG' };
    const targetCol = target.col;

    let weightChange = 0;
    let cajasChange = 0;
    const updates = [];

    if (initial_stock !== undefined) {
      updates.push({ sql: 'UPDATE inventory SET initial_stock = ? WHERE product_id = ?', params: [sanitizeNumber(initial_stock, 'initial_stock'), product_id] });
    }
    if (current_stock !== undefined) {
      const val = sanitizeNumber(current_stock, 'current_stock');
      if (mode === 'add') {
        updates.push({ sql: `UPDATE inventory SET ${targetCol} = ${targetCol} + ? WHERE product_id = ?`, params: [val, product_id] });
        weightChange = val;
      } else {
        updates.push({ sql: `UPDATE inventory SET ${targetCol} = ? WHERE product_id = ?`, params: [val, product_id] });
        weightChange = val;
      }
    }
    if (cajas !== undefined) {
      const cajasVal = sanitizeNumber(cajas, 'cajas');
      const { rows: curRows } = await query('SELECT entradas_cajas, salidas_cajas FROM inventory WHERE product_id = ?', [product_id]);
      const curEntradas = parseFloat(curRows[0]?.entradas_cajas) || 0;
      const curSalidas = parseFloat(curRows[0]?.salidas_cajas) || 0;
      if (mode === 'set') {
        updates.push({ sql: 'UPDATE inventory SET entradas_cajas = ? WHERE product_id = ?', params: [curSalidas + cajasVal, product_id] });
        cajasChange = cajasVal;
      } else {
        updates.push({ sql: 'UPDATE inventory SET entradas_cajas = entradas_cajas + ? WHERE product_id = ?', params: [cajasVal, product_id] });
        cajasChange = cajasVal;
      }
    }

    if (updates.length > 0) {
      await runTransaction(updates);
    }

    const adjInfo = await query(
      `INSERT INTO stock_adjustments (product_id, warehouse, bodega_col, weight_change, cajas_change, role) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      [product_id, warehouse, targetCol, weightChange, cajasChange, req.headers['x-role'] || 'desconocido']
    );

    const { rows: pRowsAdj } = await query('SELECT name FROM products WHERE id = ?', [product_id]);
    const pNameAdj = pRowsAdj[0]?.name || `Producto #${product_id}`;
    let details = '';
    if (current_stock !== undefined) details += `Agregado: ${current_stock} ${target.unit} a ${warehouse}. `;
    if (cajas !== undefined) details += `Cajas: +${cajas}.`;
    await logActivity({ role: req.headers['x-role'] || 'desconocido', action: 'AJUSTE STOCK', entity: 'inventory', product_name: pNameAdj, quantity: current_stock ?? cajas ?? 0, unit: target.unit, location: warehouse || 'Bodega', details });

    res.json({ success: true, adjustment_id: adjInfo.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/inventory/adjustments', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { rows: countRows } = await query('SELECT COUNT(*) as total FROM stock_adjustments');
    const total = countRows[0]?.total || 0;
    const { rows } = await query(`
      SELECT sa.*, p.code as product_code, p.name as product_name
      FROM stock_adjustments sa
      LEFT JOIN products p ON sa.product_id = p.id
      ORDER BY sa.id DESC LIMIT ? OFFSET ?
    `, [limit, offset]);
    res.json({ rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventory/undo-adjustment', async (req, res) => {
  const { id } = req.body;
  try {
    validateRequired(req.body, ['id']);
    const { rows } = await query('SELECT * FROM stock_adjustments WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ajuste no encontrado' });
    const adj = rows[0];
    const weightChange = parseFloat(adj.weight_change) || 0;
    const cajasChange = parseInt(adj.cajas_change) || 0;

    // Verify sufficient stock to reverse
    if (weightChange > 0) {
      const { rows: check } = await query(`SELECT ${adj.bodega_col} FROM inventory WHERE product_id = ?`, [adj.product_id]);
      const current = parseFloat(check[0]?.[adj.bodega_col]) || 0;
      if (current < weightChange) {
        return res.status(400).json({ error: `Stock insuficiente para revertir ajuste: tiene ${current.toFixed(2)}, necesita ${weightChange.toFixed(2)}` });
      }
    }

    const updates = [];
    if (weightChange > 0) {
      updates.push({ sql: `UPDATE inventory SET ${adj.bodega_col} = ${adj.bodega_col} - ? WHERE product_id = ?`, params: [weightChange, adj.product_id] });
    }
    if (cajasChange > 0) {
      updates.push({ sql: 'UPDATE inventory SET entradas_cajas = GREATEST(entradas_cajas - ?, 0) WHERE product_id = ?', params: [cajasChange, adj.product_id] });
    }
    updates.push({ sql: 'DELETE FROM stock_adjustments WHERE id = ?', params: [id] });

    await runTransaction(updates);

    const { rows: pRows } = await query('SELECT name FROM products WHERE id = ?', [adj.product_id]);
    const pName = pRows[0]?.name || `Producto #${adj.product_id}`;
    await logActivity({ role: req.headers['x-role'] || 'desconocido', action: 'REVERTIR AJUSTE', entity: 'inventory', product_name: pName, quantity: weightChange || cajasChange, unit: adj.warehouse === 'Ransa' ? 'KG' : 'Lbs', location: adj.warehouse, details: `Revertido ajuste #${id}: -${weightChange} ${adj.warehouse === 'Ransa' ? 'KG' : 'Lbs'}, -${cajasChange} cajas` });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err.message, err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.get('/api/reports/inventory-status', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT p.code, p.name, i.initial_stock, i.sold_stock, i.bodega_1, i.bodega_2, i.bodega_3, i.bodega_4, i.entradas_cajas, i.salidas_cajas,
             (i.bodega_1 + i.bodega_2 + i.bodega_3 + i.bodega_4) as final_stock,
             (i.entradas_cajas - i.salidas_cajas) as stock_cajas
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
  const dateFunc = pool ? "to_char(s.date, 'YYYY-MM')" : "strftime('%Y-%m', s.date)";
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
           i.bodega_3 as stock_b3,
           i.entradas_cajas,
           i.salidas_cajas,
           (i.entradas_cajas - i.salidas_cajas) as stock_cajas
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
  const { product_id, origin, destination, origin_weight, dest_weight, weight, unit_type } = req.body;
  try {
    validateRequired(req.body, ['product_id', 'origin', 'destination', 'weight']);
    const deductWeight = sanitizeNumber(origin_weight ?? weight ?? 0, 'weight', false);
    const addWeight = sanitizeNumber(dest_weight ?? weight ?? 0, 'dest_weight', false);
    const colMap = {
      'Ransa': 'bodega_1',
      'Central de abasto - Soyapango (Cuarto Frío)': 'bodega_2',
      'Soyapango': 'bodega_2',
      'Central de abasto - Usulután (Cuarto Frío)': 'bodega_3',
      'Usulután': 'bodega_3',
      'Lomas de San Francisco': 'bodega_4'
    };
    const originCol = colMap[origin];
    const destCol = colMap[destination];
    if (!originCol || !destCol) {
      return res.status(400).json({ error: 'Origen o destino inválido' });
    }

    if (unit_type === 'Cajas') {
      const boxCount = parseInt(weight) || 0;
      if (boxCount > 0) {
        await query('UPDATE inventory SET salidas_cajas = salidas_cajas + ? WHERE product_id = ?', [boxCount, product_id]);
      }
    } else {
      // Verify sufficient stock
      const { rows: check } = await query(`SELECT ${originCol} FROM inventory WHERE product_id = ?`, [product_id]);
      const current = parseFloat(check[0]?.[originCol]) || 0;
      if (current < deductWeight) {
        return res.status(400).json({ error: `Stock insuficiente en origen: tiene ${current.toFixed(2)}, necesita ${deductWeight.toFixed(2)}` });
      }
    }

    const updates = unit_type === 'Cajas'
      ? [{ sql: 'INSERT INTO movements (product_id, origin_warehouse, dest_warehouse, weight, type, origin_weight, dest_weight, unit_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', params: [product_id, origin, destination, deductWeight, 'TRANSFER', deductWeight, addWeight, unit_type || 'Lbs'] }]
      : [
          { sql: `UPDATE inventory SET ${originCol} = ${originCol} - ? WHERE product_id = ?`, params: [deductWeight, product_id] },
          { sql: `UPDATE inventory SET ${destCol} = ${destCol} + ? WHERE product_id = ?`, params: [addWeight, product_id] },
          { sql: 'INSERT INTO movements (product_id, origin_warehouse, dest_warehouse, weight, type, origin_weight, dest_weight, unit_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', params: [product_id, origin, destination, deductWeight, 'TRANSFER', deductWeight, addWeight, unit_type || 'Lbs'] }
        ];

    await runTransaction(updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Movements (transfers) CRUD ---
app.get('/api/movements', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
    const offset = (page - 1) * limit;
    const { rows: countRows } = await query('SELECT COUNT(*) as total FROM movements');
    const total = countRows[0]?.total || 0;
    const { rows } = await query(`
      SELECT m.*, p.name as product_name, p.code as product_code
      FROM movements m
      LEFT JOIN products p ON m.product_id = p.id
      ORDER BY m.date DESC, m.id DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    res.json({ rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Error fetching movements:', err.message);
    res.json({ rows: [], total: 0, page: 1, limit: 100, pages: 0 });
  }
});

app.delete('/api/movements/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Transfers are final — no inventory restoration
    await query('DELETE FROM movements WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/movements/:id', async (req, res) => {
  const { id } = req.params;
  const { weight, origin_weight, dest_weight, unit_type } = req.body;
  try {
    // Transfers are final — update only the log, no inventory changes
    await query('UPDATE movements SET weight = ?, origin_weight = ?, dest_weight = ?, unit_type = ? WHERE id = ?',
      [weight ?? origin_weight ?? 0, origin_weight ?? weight ?? 0, dest_weight ?? weight ?? 0, unit_type || 'Cajas', id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/production/process', async (req, res) => {
  const { product_id, initial_kg, cut_weight, waste, storage_cost, transport_cost, labor_cost, other_costs } = req.body;
  try {
    validateRequired(req.body, ['product_id', 'initial_kg', 'cut_weight']);
    const initKg = sanitizeNumber(initial_kg, 'initial_kg', false);
    const cutLbs = sanitizeNumber(cut_weight, 'cut_weight', false);

    // Verify sufficient stock in Ransa
    const { rows: check } = await query('SELECT bodega_1 FROM inventory WHERE product_id = ?', [product_id]);
    const current = parseFloat(check[0]?.bodega_1) || 0;
    if (current < initKg) {
      return res.status(400).json({ error: `Stock insuficiente en Ransa: tiene ${current.toFixed(2)} kg, necesita ${initKg.toFixed(2)} kg` });
    }

    await runTransaction([
      { sql: 'INSERT INTO production_logs (product_id, initial_weight, cut_weight, waste, storage_cost, transport_cost, labor_cost, other_costs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', params: [product_id, initKg, cutLbs, waste || 0, storage_cost || 0, transport_cost || 0, labor_cost || 0, other_costs || 0] },
      { sql: 'UPDATE inventory SET bodega_1 = bodega_1 - ? WHERE product_id = ?', params: [initKg, product_id] },
      { sql: 'UPDATE inventory SET bodega_2 = bodega_2 + ? WHERE product_id = ?', params: [cutLbs, product_id] },
      { sql: 'INSERT INTO movements (product_id, origin_warehouse, dest_warehouse, weight, type) VALUES (?, ?, ?, ?, ?)', params: [product_id, 'Ransa (KG)', 'Soyapango (Lbs)', cutLbs, 'TRANSFER'] }
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/production/logs', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
    const offset = (page - 1) * limit;
    const { rows: countRows } = await query('SELECT COUNT(*) as total FROM production_logs');
    const total = countRows[0]?.total || 0;
    const { rows } = await query(`
      SELECT l.*, p.name as product_name FROM production_logs l
      LEFT JOIN products p ON l.product_id = p.id
      ORDER BY l.date DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    res.json({ rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Error fetching production logs:', err.message);
    res.json({ rows: [], total: 0, page: 1, limit: 100, pages: 0 });
  }
});

// POST /api/production/logs — usado por el formulario de producción del frontend
app.post('/api/production/logs', async (req, res) => {
  const { product_id, initial_weight, cut_weight, waste, storage_cost, transport_cost, labor_cost, other_costs, process_mode, dest_warehouse } = req.body;
  try {
    validateRequired(req.body, ['product_id', 'cut_weight']);
    const initKg = initial_weight !== undefined && initial_weight !== '' ? sanitizeNumber(initial_weight, 'initial_weight') : 0;
    const cutLbs = sanitizeNumber(cut_weight, 'cut_weight', false);
    const wasteVal = parseFloat(waste) || (initKg > 0 ? initKg * 2.20462 - cutLbs : 0);

    const updates = [
      { sql: 'INSERT INTO production_logs (product_id, initial_weight, cut_weight, waste, storage_cost, transport_cost, labor_cost, other_costs, dest_warehouse) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', params: [product_id, initKg, cutLbs, wasteVal, storage_cost || 0, transport_cost || 0, labor_cost || 0, other_costs || 0, process_mode === 'direct' ? (dest_warehouse || 'Soyapango') : ''] }
    ];

    if (process_mode === 'direct') {
      const destColMap = {
        'Soyapango': 'bodega_2',
        'Usulután': 'bodega_3',
        'Lomas de San Francisco': 'bodega_4'
      };
      const destCol = destColMap[dest_warehouse];
      if (!destCol) {
        return res.status(400).json({ error: 'Destino de producción directa inválido' });
      }
      if (cutLbs > 0) {
        updates.push({ sql: `UPDATE inventory SET ${destCol} = ${destCol} + ? WHERE product_id = ?`, params: [cutLbs, product_id] });
      }
      updates.push({ sql: 'INSERT INTO movements (product_id, origin_warehouse, dest_warehouse, weight, type) VALUES (?, ?, ?, ?, ?)', params: [product_id, 'Proceso directo', dest_warehouse, cutLbs, 'INCOME'] });

      await runTransaction(updates);
      const { rows: pRowsProd } = await query('SELECT name FROM products WHERE id = ?', [product_id]);
      const pNameProd = pRowsProd[0]?.name || `Producto #${product_id}`;
      await logActivity({ role: req.headers['x-role'] || 'desconocido', action: 'PRODUCCIÓN DIRECTA', entity: 'production_logs', product_name: pNameProd, quantity: cutLbs, unit: 'Lbs', location: dest_warehouse, details: `Peso procesado: ${cutLbs} lbs → ${dest_warehouse}` });
    } else if (initKg > 0) {
      // Verify sufficient stock
      const { rows: check } = await query('SELECT bodega_1 FROM inventory WHERE product_id = ?', [product_id]);
      const current = parseFloat(check[0]?.bodega_1) || 0;
      if (current < initKg) {
        return res.status(400).json({ error: `Stock insuficiente en Ransa: tiene ${current.toFixed(2)} kg, necesita ${initKg.toFixed(2)} kg` });
      }
      updates.push({ sql: 'UPDATE inventory SET bodega_1 = bodega_1 - ? WHERE product_id = ?', params: [initKg, product_id] });
      updates.push({ sql: 'UPDATE inventory SET bodega_2 = bodega_2 + ? WHERE product_id = ?', params: [cutLbs, product_id] });
      updates.push({ sql: 'INSERT INTO movements (product_id, origin_warehouse, dest_warehouse, weight, type) VALUES (?, ?, ?, ?, ?)', params: [product_id, 'Ransa (KG)', 'Soyapango (Lbs)', cutLbs, 'TRANSFER'] });

      await runTransaction(updates);
      const { rows: pRowsProd } = await query('SELECT name FROM products WHERE id = ?', [product_id]);
      const pNameProd = pRowsProd[0]?.name || `Producto #${product_id}`;
      await logActivity({ role: req.headers['x-role'] || 'desconocido', action: 'PRODUCCIÓN', entity: 'production_logs', product_name: pNameProd, quantity: initKg, unit: 'KG', location: 'Ransa → Soyapango', details: `Entrada: ${initKg} kg | Salida: ${cutLbs} lbs | Merma: ${wasteVal.toFixed(2)} lbs` });
    } else {
      await runTransaction(updates);
      const { rows: pRowsProd } = await query('SELECT name FROM products WHERE id = ?', [product_id]);
      const pNameProd = pRowsProd[0]?.name || `Producto #${product_id}`;
      await logActivity({ role: req.headers['x-role'] || 'desconocido', action: 'PRODUCCIÓN', entity: 'production_logs', product_name: pNameProd, quantity: cutLbs, unit: 'Lbs', location: 'Proceso', details: `Salida: ${cutLbs} lbs` });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/production/logs/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await query('SELECT * FROM production_logs WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Producción no encontrada' });
    const log = rows[0];
    const initKg = parseFloat(log.initial_weight) || 0;

    if (initKg > 0) {
      // Standard Ransa process: revert from Soyapango (b2), restore to Ransa (b1)
      const { rows: check } = await query('SELECT bodega_2 FROM inventory WHERE product_id = ?', [log.product_id]);
      const current = parseFloat(check[0]?.bodega_2) || 0;
      if (current < log.cut_weight) {
        return res.status(400).json({ error: `Stock insuficiente en Soyapango para revertir: tiene ${current.toFixed(2)} lbs, necesita ${log.cut_weight} lbs` });
      }
      await runTransaction([
        { sql: 'UPDATE inventory SET bodega_1 = bodega_1 + ? WHERE product_id = ?', params: [initKg, log.product_id] },
        { sql: 'UPDATE inventory SET bodega_2 = bodega_2 - ? WHERE product_id = ?', params: [log.cut_weight, log.product_id] },
        { sql: 'DELETE FROM production_logs WHERE id = ?', params: [id] }
      ]);
    } else {
      // Direct process: use stored dest_warehouse to revert
      const wh = log.dest_warehouse || 'Soyapango';
      const destColMap = { 'Soyapango': 'bodega_2', 'Usulután': 'bodega_3', 'Lomas de San Francisco': 'bodega_4' };
      const destCol = destColMap[wh] || 'bodega_2';
      const { rows: check } = await query(`SELECT ${destCol} FROM inventory WHERE product_id = ?`, [log.product_id]);
      const current = parseFloat(check[0]?.[destCol]) || 0;
      if (current < log.cut_weight) {
        return res.status(400).json({ error: `Stock insuficiente en ${wh} para revertir: tiene ${current.toFixed(2)} lbs, necesita ${log.cut_weight} lbs` });
      }
      await runTransaction([
        { sql: `UPDATE inventory SET ${destCol} = ${destCol} - ? WHERE product_id = ?`, params: [log.cut_weight, log.product_id] },
        { sql: 'DELETE FROM production_logs WHERE id = ?', params: [id] }
      ]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/production/logs/:id', async (req, res) => {
  const { id } = req.params;
  const { initial_weight, cut_weight, waste } = req.body;
  try {
    validateRequired(req.body, ['cut_weight']);
    const { rows } = await query('SELECT * FROM production_logs WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Producción no encontrada' });
    const old = rows[0];
    const initKg = sanitizeNumber(initial_weight, 'initial_weight');
    const cutLbs = sanitizeNumber(cut_weight, 'cut_weight', false);
    const wasteVal = sanitizeNumber(waste, 'waste');

    // Verify sufficient stock for reverting old values
    const { rows: check } = await query('SELECT bodega_2 FROM inventory WHERE product_id = ?', [old.product_id]);
    const currentB2 = parseFloat(check[0]?.bodega_2) || 0;
    if (currentB2 < old.cut_weight) {
      return res.status(400).json({ error: `Stock insuficiente en Soyapango para editar: tiene ${currentB2.toFixed(2)} lbs, necesita ${old.cut_weight} lbs` });
    }
    // Check Ransa stock for new deduction if increasing
    if (initKg > old.initial_weight) {
      const diff = initKg - old.initial_weight;
      const { rows: checkB1 } = await query('SELECT bodega_1 FROM inventory WHERE product_id = ?', [old.product_id]);
      const currentB1 = parseFloat(checkB1[0]?.bodega_1) || 0;
      if (currentB1 < diff) {
        return res.status(400).json({ error: `Stock insuficiente en Ransa para aumentar: tiene ${currentB1.toFixed(2)} kg, necesita ${diff.toFixed(2)} kg adicionales` });
      }
    }

    await runTransaction([
      { sql: 'UPDATE inventory SET bodega_1 = bodega_1 + ? WHERE product_id = ?', params: [old.initial_weight, old.product_id] },
      { sql: 'UPDATE inventory SET bodega_2 = bodega_2 - ? WHERE product_id = ?', params: [old.cut_weight, old.product_id] },
      { sql: 'UPDATE inventory SET bodega_1 = bodega_1 - ? WHERE product_id = ?', params: [initKg, old.product_id] },
      { sql: 'UPDATE inventory SET bodega_2 = bodega_2 + ? WHERE product_id = ?', params: [cutLbs, old.product_id] },
      { sql: 'UPDATE production_logs SET initial_weight = ?, cut_weight = ?, waste = ? WHERE id = ?', params: [initKg, cutLbs, wasteVal, id] }
    ]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/dispatches/:id', async (req, res) => {
  const { id } = req.params;
  const { weight, value } = req.body;
  try {
    validateRequired(req.body, ['weight', 'value']);
    const { rows } = await query('SELECT * FROM dispatches WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Despacho no encontrado' });
    const old = rows[0];

    const agroToBodegaMap = {
      1: 'bodega_1',
      2: 'bodega_2',
      3: 'bodega_3',
      4: 'bodega_4'
    };
    const bodegaCol = agroToBodegaMap[old.agro_id] || 'bodega_1';

    let oldWeightInLbs = parseFloat(old.weight);
    let newWeightInLbs = sanitizeNumber(weight, 'weight', false);

    if (old.unit_type === 'Kg') oldWeightInLbs *= 2.20462;
    if (old.unit_type === 'Kg') newWeightInLbs *= 2.20462;

    // If increasing dispatch, verify sufficient stock
    if (newWeightInLbs > oldWeightInLbs) {
      const diff = newWeightInLbs - oldWeightInLbs;
      const { rows: check } = await query(`SELECT ${bodegaCol} FROM inventory WHERE product_id = ?`, [old.product_id]);
      const current = parseFloat(check[0]?.[bodegaCol]) || 0;
      if (current < diff) {
        return res.status(400).json({ error: `Stock insuficiente para aumentar el despacho: tiene ${current.toFixed(2)} lbs, necesita ${diff.toFixed(2)} lbs adicionales` });
      }
    }

    await runTransaction([
      { sql: `UPDATE inventory SET ${bodegaCol} = ${bodegaCol} + ?, sold_stock = sold_stock - ? WHERE product_id = ?`, params: [oldWeightInLbs, oldWeightInLbs, old.product_id] },
      { sql: `UPDATE inventory SET ${bodegaCol} = ${bodegaCol} - ?, sold_stock = sold_stock + ? WHERE product_id = ?`, params: [newWeightInLbs, newWeightInLbs, old.product_id] },
      { sql: 'UPDATE dispatches SET weight = ?, value = ? WHERE id = ?', params: [weight, value, id] }
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/dispatches/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Simple delete — dispatches are final sales, inventory is NOT restored
    await query('DELETE FROM dispatches WHERE id = ?', [id]);
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
    // Use different queries for PG (RETURNING) vs SQLite (lastInsertRowid)
    let info;
    if (pool) {
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
    // Ensure inventory exists for new products - includes all bodega columns
    const { rows: prods } = await query('SELECT id, code FROM products');
    for (const p of prods) {
      const physicalData = physicalInventoryData[p.code] || {};
      await query(`
        INSERT INTO inventory (product_id, bodega_1, bodega_2, bodega_3, bodega_4, initial_stock, current_stock, sold_stock)
        VALUES (?, ?, 0, ?, 0, 100, 100, 0)
        ON CONFLICT(product_id) DO NOTHING
      `, [p.id, physicalData.bodega_1 || 0, physicalData.bodega_3 || 0]);
    }

    res.json({ success: true, message: 'Catálogo sincronizado con la imagen' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/clear-inventory', async (req, res) => {
  try {
    console.log('[CLEAR-INVENTORY] Starting inventory clear...');
    const r1 = await query('UPDATE inventory SET bodega_1 = 0, bodega_2 = 0, bodega_3 = 0, bodega_4 = 0, current_stock = 0, sold_stock = 0');
    console.log('[CLEAR-INVENTORY] Inventory updated, result:', r1);
    await query('DELETE FROM movements');
    console.log('[CLEAR-INVENTORY] Movements deleted');
    await query('DELETE FROM production_logs');
    console.log('[CLEAR-INVENTORY] Production logs deleted');
    await query('DELETE FROM dispatches');
    console.log('[CLEAR-INVENTORY] Dispatches deleted');
    await query('DELETE FROM ransa_requests');
    console.log('[CLEAR-INVENTORY] Ransa requests deleted');
    // Verify the update worked
    const verify = await query('SELECT COUNT(*) as total, SUM(bodega_1 + bodega_2 + bodega_3 + bodega_4) as sum FROM inventory');
    console.log('[CLEAR-INVENTORY] Verification:', verify.rows[0]);
    res.json({ success: true, message: 'Inventario vaciado completamente' });
  } catch (err) {
    console.error('[CLEAR-INVENTORY] Error:', err);
    res.status(500).json({ error: err.message });
  }
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

// Sync inventory from physical inventory data
// Bodega mapping: bodega_1 = Ransa (KG), bodega_2 = Soyapango (LBS), bodega_3 = Usulután (LBS), bodega_4 = Lomas (LBS)
const physicalInventoryData = {
  "1618": { name: "Sin Hueso Nalga Adentro", bodega_1: 0, bodega_3: 9168.1 },
  "1619": { name: "Cajas Tortuguita", bodega_1: 0, bodega_3: 5948.9 },
  "1620": { name: "Con Hueso Cogote", bodega_1: 0, bodega_3: 0 },
  "1621": { name: "Sin Hueso Bife Angosto", bodega_1: 0, bodega_3: 0 },
  "1622": { name: "Recorte 80.20", bodega_1: 0, bodega_3: 0 },
  "1623": { name: "Recorte 50.50", bodega_1: 0, bodega_3: 0 },
  "1624": { name: "Aguja", bodega_1: 0, bodega_3: 4808.9 },
  "1625": { name: "Corazón Cuadril", bodega_1: 0, bodega_3: 0 },
  "1626": { name: "Sin Hueso Delantero", bodega_1: 0, bodega_3: 1072.3 },
  "1627": { name: "Sin Hueso Tapa Cuadril", bodega_1: 0, bodega_3: 0 },
  "1628": { name: "Sin Hueso Recorte de Carne", bodega_1: 0, bodega_3: 5595.4 }
};

app.post('/api/admin/sync-inventory-weights', async (req, res) => {
  try {
    console.log('[SYNC-INVENTORY] Starting inventory sync from physical data...');
    const { rows: products } = await query('SELECT id, code, name FROM products');
    let syncedCount = 0;
    
    for (const product of products) {
      const physicalData = physicalInventoryData[product.code];
      if (physicalData) {
        // Check current inventory values - only sync if all bodegas are zero
        const { rows: current } = await query('SELECT bodega_1, bodega_2, bodega_3, bodega_4 FROM inventory WHERE product_id = ?', [product.id]);
        const inv = current[0] || {};
        const totalStock = (inv.bodega_1 || 0) + (inv.bodega_2 || 0) + (inv.bodega_3 || 0) + (inv.bodega_4 || 0);
        
        // Only sync if product has no stock (all zeros)
        if (totalStock === 0) {
          await query(`
            UPDATE inventory SET 
              bodega_1 = ?,
              bodega_2 = 0,
              bodega_3 = ?,
              bodega_4 = 0,
              current_stock = ? + ?
            WHERE product_id = ?
          `, [
            physicalData.bodega_1, physicalData.bodega_3,
            physicalData.bodega_1, physicalData.bodega_3, product.id
          ]);
          console.log(`[SYNC] Initialized product ${product.code} (${product.name}): bodega_1=${physicalData.bodega_1}, bodega_3=${physicalData.bodega_3}`);
          syncedCount++;
        } else {
          console.log(`[SYNC] Skipped product ${product.code} (${product.name}): already has stock (${totalStock})`);
        }
      }
    }
    
    // Verify the sync
    const verify = await query('SELECT p.code, p.name, i.bodega_1, i.bodega_2, i.bodega_3, i.bodega_4, (i.bodega_1 + i.bodega_2 + i.bodega_3 + i.bodega_4) as total FROM inventory i JOIN products p ON i.product_id = p.id ORDER BY CAST(p.code AS INTEGER)');
    console.log('[SYNC-INVENTORY] Verification after sync:', verify.rows);
    
    res.json({ success: true, message: `Inventario sincronizado: ${syncedCount} productos inicializados (los demás ya tenían stock)`, data: verify.rows });
  } catch (err) {
    console.error('[SYNC-INVENTORY] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- DATA EXPORT & CLEANUP ---
// Returns the oldest record date across all transaction tables (for reminders)
app.get('/api/admin/data-age', async (req, res) => {
  try {
    const results = await query(`
      SELECT MIN(mindate) as oldest FROM (
        SELECT MIN(date) as mindate FROM movements
        UNION ALL SELECT MIN(date) FROM dispatches
        UNION ALL SELECT MIN(date) FROM sales
        UNION ALL SELECT MIN(date) FROM production_logs
        UNION ALL SELECT MIN(date) FROM ransa_requests
        UNION ALL SELECT MIN(date) FROM food_costing
        UNION ALL SELECT MIN(created_at) FROM stock_adjustments
        UNION ALL SELECT MIN(created_at) FROM activity_log
      )
    `);
    res.json({ oldest: results.rows[0]?.oldest || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export all transaction data as JSON (for Excel generation on frontend)
app.get('/api/admin/export-data', async (req, res) => {
  try {
    const before = req.query.before || '9999-12-31';
    const [movements, dispatches, sales, production_logs, ransa_requests, food_costing, stock_adjustments, activity_log] = await Promise.all([
      query(`SELECT * FROM movements WHERE date <= ? ORDER BY date`, [before]),
      query(`SELECT d.*, a.name as agro_name, p.name as product_name FROM dispatches d LEFT JOIN agros a ON d.agro_id = a.id LEFT JOIN products p ON d.product_id = p.id WHERE d.date <= ? ORDER BY d.date`, [before]),
      query(`SELECT s.*, a.name as agro_name FROM sales s LEFT JOIN agros a ON s.agro_id = a.id WHERE s.date <= ? ORDER BY s.date`, [before]),
      query(`SELECT * FROM production_logs WHERE date <= ? ORDER BY date`, [before]),
      query(`SELECT * FROM ransa_requests WHERE date <= ? ORDER BY date`, [before]),
      query(`SELECT * FROM food_costing WHERE date <= ? ORDER BY date`, [before]),
      query(`SELECT * FROM stock_adjustments WHERE created_at <= ? ORDER BY created_at`, [before]),
      query(`SELECT * FROM activity_log WHERE created_at <= ? ORDER BY created_at`, [before])
    ]);
    res.json({
      movements: movements.rows,
      dispatches: dispatches.rows,
      sales: sales.rows,
      production_logs: production_logs.rows,
      ransa_requests: ransa_requests.rows,
      food_costing: food_costing.rows,
      stock_adjustments: stock_adjustments.rows,
      activity_log: activity_log.rows,
      before
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete all exported transaction data before a given date
app.post('/api/admin/cleanup-data', async (req, res) => {
  try {
    const { before } = req.body;
    if (!before) return res.status(400).json({ error: 'Se requiere fecha (before)' });
    const deletes = [
      query('DELETE FROM movements WHERE date <= ?', [before]),
      query('DELETE FROM dispatches WHERE date <= ?', [before]),
      query('DELETE FROM sales WHERE date <= ?', [before]),
      query('DELETE FROM production_logs WHERE date <= ?', [before]),
      query('DELETE FROM ransa_requests WHERE date <= ?', [before]),
      query('DELETE FROM food_costing WHERE date <= ?', [before]),
      query('DELETE FROM stock_adjustments WHERE created_at <= ?', [before]),
      query('DELETE FROM activity_log WHERE created_at <= ?', [before])
    ];
    const results = await Promise.all(deletes);
    res.json({ success: true, message: `Datos anteriores a ${before} eliminados correctamente` });
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
  migrateDatabase().then(async () => {
    // Seed initial data only when inventory is completely fresh (no product rows)
    try {
      const { rows: invCheck } = await query('SELECT COUNT(*) as cnt FROM inventory WHERE initial_stock > 0');
      if (parseInt(invCheck[0]?.cnt || 0) === 0) {
        const { rows: pCount } = await query('SELECT COUNT(*) as cnt FROM products');
        if (pCount[0].cnt > 0) {
          // Seed cajas (entradas and salidas)
          const cajasSeed = { "1618":326,"1619":200,"1620":114,"1621":45,"1622":43,"1623":45,"1624":105,"1625":55,"1626":46,"1627":53,"1628":186 };
          const salidasSeed = { "1618":103,"1619":41,"1620":105,"1621":32,"1622":20,"1623":34,"1624":1,"1625":55,"1626":2,"1627":21,"1628":33 };
          for (const [code, cajas] of Object.entries(cajasSeed)) {
            const { rows: pRows } = await query('SELECT id FROM products WHERE code = ?', [code]);
            if (pRows.length > 0) {
              await query('UPDATE inventory SET entradas_cajas = ?, salidas_cajas = ? WHERE product_id = ?', [cajas, salidasSeed[code] || 0, pRows[0].id]);
            }
          }

          // Seed Usulután (bodega_3)
          const b3Seed = { "1618":9468.1,"1619":5948.9,"1624":4808.9,"1626":1072.3,"1628":5595.4 };
          for (const [code, val] of Object.entries(b3Seed)) {
            const { rows: pRows } = await query('SELECT id FROM products WHERE code = ?', [code]);
            if (pRows.length > 0) {
              await query('UPDATE inventory SET bodega_3 = ? WHERE product_id = ?', [val, pRows[0].id]);
            }
          }

          console.log('[SEED] Initial data seeded successfully');
        }
      } else {
        console.log('[SEED] Inventory already has data — no seeding needed');
      }
    } catch (err) {
      console.error('[SEED] Error:', err.message);
    }
    
    // Auto-backup before starting
    await backupDatabase();

    app.listen(port, '0.0.0.0', () => {
      console.log(`Server running at port ${port}`);
      console.log('All changes applied: New locations, stock levels, and deduction logic');

      // Auto-deploy watcher: starts automatically when running locally
      if (!process.env.RENDER) {
        console.log('👀 Iniciando auto-deploy watcher (local)...');
        const watcher = spawn('node', [join(__dirname, '../scripts/watch-deploy.js')], {
          cwd: join(__dirname, '..'),
          stdio: 'inherit',
          env: { ...process.env }
        });
        watcher.on('error', (err) => console.error('⚠️ Auto-deploy watcher error:', err.message));
        watcher.on('exit', (code) => console.log(`Auto-deploy watcher exited with code ${code}`));
      }
    });
  }).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}).catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
