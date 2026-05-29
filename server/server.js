import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
import * as db from './github-db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000; // Auto-deploy: GitHub Actions + watch-deploy + post-commit hook

app.use(cors());
app.use(express.json());
if (!process.env.VERCEL) app.use(express.static(join(__dirname, '../dist')));

// Public URL exposure (for auto-start scripts)
async function getPublicUrl() {
  try {
    const path = join(__dirname, '../PUBLIC_URL.txt');
    const url = (await readFile(path, 'utf8')).trim();
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
  const version = process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || Date.now().toString();
  res.send(version);
});

// Sync in-memory DB to GitHub after every response
app.use((req, res, next) => {
  const originalEnd = res.end;
  res.end = function(...args) {
    db.syncToGitHub().catch(e => console.warn('[SYNC] Error:', e.message));
    return originalEnd.apply(this, args);
  };
  next();
});

// Unified Query Helper
async function query(sql, params = []) {
  return db.query(sql, params);
}

// Ensure inventory exists for a product to prevent silent UPDATE failures
async function ensureInventoryExists(product_id) {
  if (!product_id) return;
  await query(`
    INSERT INTO inventory (product_id, bodega_1, bodega_2, bodega_3, bodega_4, initial_stock, current_stock, sold_stock, cajas, entradas_cajas, salidas_cajas)
    VALUES ($1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
    ON CONFLICT(product_id) DO NOTHING
  `, [product_id]);
}

// Execute multiple SQL updates atomically in a transaction
async function runTransaction(updates) {
  if (updates.length === 0) return;
  await query('BEGIN');
  try {
    for (const u of updates) {
      await query(u.sql, u.params);
    }
    await query('COMMIT');
  } catch (e) {
    await query('ROLLBACK');
    throw e;
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



async function exec(sql) {
  return db.exec(sql);
}

// --- MIGRATION ---
const migrateDatabase = async () => {
  console.log('Running database migration...');
  // Tables already created by github-db.js initData()

  // Ensure inventory rows exist for all products
  const { rows: prods } = await query('SELECT id FROM products');
  for (const p of prods) {
    await query(`
      INSERT INTO inventory (product_id, bodega_1, bodega_2, bodega_3, bodega_4, initial_stock, sold_stock, cajas, entradas_cajas, salidas_cajas) 
      VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0, 0)
      ON CONFLICT(product_id) DO NOTHING
    `, [p.id]);
  }

  console.log('Database migration completed successfully');

  // --- Auto-restore from seed-data.json if inventory is empty ---
  try {
    const seedPath = join(__dirname, 'seed-data.json');
    const seed = JSON.parse(await readFile(seedPath, 'utf8'));
    const { rows: allProds } = await query('SELECT id, code FROM products');

    const { rows: check } = await query('SELECT COUNT(*) as cnt FROM inventory');
    const total = check[0]?.cnt || 0;
    console.log(`[SEED] Total inventario actual: ${total}`);

    if (total === 0) {
      console.log('[SEED] Inventario vacío, restaurando desde seed-data.json...');
      for (const p of allProds) {
        const b2 = seed.bodega_2?.[p.code] ?? 0;
        const b3 = seed.bodega_3?.[p.code] ?? 0;
        const b4 = seed.bodega_4?.[p.code] ?? 0;
        const b1 = seed.bodega_1?.[p.code] ?? 0;
        const initStock = seed.initial_stock?.[p.code] ?? 0;
        const c = seed.cajas?.[p.code] || { entradas: 0, salidas: 0 };
        await query(
          'UPDATE inventory SET bodega_1 = ?, bodega_2 = ?, bodega_3 = ?, bodega_4 = ?, initial_stock = ?, current_stock = ?, entradas_cajas = ?, salidas_cajas = ? WHERE product_id = ?',
          [b1, b2, b3, b4, initStock, seed.current_stock || 0, c.entradas, c.salidas, p.id]
        );
      }
      console.log('✅ Seed restaurado: bodega_1-4, cajas, initial_stock');
    } else {
      console.log('[SEED] Inventario con datos, omitiendo restore');
    }
  } catch(e) {
    console.warn('[SEED] Error:', e.message);
  }

  // --- Dedup: clean duplicate product codes ---
  try {
    const { rows: allProducts } = await query('SELECT id, code FROM products WHERE code IS NOT NULL AND code != \'\'');
    const codeMap = {};
    for (const p of allProducts) {
      if (!codeMap[p.code]) codeMap[p.code] = [];
      codeMap[p.code].push(p.id);
    }
    for (const [code, ids] of Object.entries(codeMap)) {
      if (ids.length > 1) {
        console.log(`[DEDUP] Code ${code} has ${ids.length} duplicates, removing extras`);
        for (let j = 1; j < ids.length; j++) {
          await query('DELETE FROM inventory WHERE product_id = ?', [ids[j]]);
          await query('DELETE FROM products WHERE id = ?', [ids[j]]);
          console.log(`[DEDUP] Eliminado duplicado ID ${ids[j]}`);
        }
      }
    }
  } catch (e) { console.warn('[DEDUP] Error:', e.message); }

  // --- Dedup: remove duplicate inventory rows for same product_id ---
  try {
    const { rows: allInv } = await query('SELECT product_id FROM inventory');
    const invMap = {};
    for (const r of allInv) {
      if (!invMap[r.product_id]) invMap[r.product_id] = 0;
      invMap[r.product_id]++;
    }
    for (const [pid, count] of Object.entries(invMap)) {
      if (count > 1) {
        console.log(`[DEDUP INV] Product ${pid} has ${count} inventory rows, keeping first`);
        const { rows: dups } = await query('SELECT * FROM inventory WHERE product_id = ?', [parseInt(pid)]);
        for (let j = 1; j < dups.length; j++) {
          await query('DELETE FROM inventory WHERE product_id = ? AND entradas_cajas = ? AND salidas_cajas = ?', [parseInt(pid), dups[j].entradas_cajas, dups[j].salidas_cajas]);
        }
      }
    }
  } catch (e) { console.warn('[DEDUP INV] Error:', e.message); }

  // NOTE: syncToGitHub not called here intentionally.
  // The post-response middleware handles sync after each response.
};

// --- INITIALIZATION ---
const initDb = async () => {
  // Tables already created by github-db.js init()
  // Seed default products if table is empty
  const { rows: existingProducts } = await query('SELECT COUNT(*) as cnt FROM products');
  if (parseInt(existingProducts[0]?.cnt || 0) === 0) {
    console.log('Seeding official product catalog...');
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
    for (const p of products) {
      try {
        await query('INSERT OR IGNORE INTO products (code, name, category, price_per_lb, price_per_kg, price_per_box) VALUES (?, ?, ?, ?, ?, ?)', p);
      } catch (e) { }
    }
  }

  // Ensure inventory rows exist for all products
  const { rows: prods } = await query('SELECT id FROM products');
  for (const p of prods) {
    await query(`
      INSERT OR IGNORE INTO inventory (product_id, bodega_1, bodega_2, bodega_3, bodega_4, initial_stock, sold_stock, current_stock, cajas, entradas_cajas, salidas_cajas) 
      VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
    `, [p.id]);
  }

  // Seed default agros if needed
  const { rows: existingAgros } = await query('SELECT COUNT(*) as cnt FROM agros');
  if (parseInt(existingAgros[0]?.cnt || 0) === 0) {
    const agros = [
      'Soyapango - Puesto', 'Usulután - Puesto', 'Agro Quezaltepeque',
      'Agro Aguilares', 'Agro Opico', 'MAG (Gobierno)',
      'CNR (Gobierno)', 'Relaciones Exteriores (Gobierno)', 'Lomas de San Francisco'
    ];
    for (const a of agros) {
      await query('INSERT OR IGNORE INTO agros (name) VALUES (?)', [a]);
    }
  }
};

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
    await ensureInventoryExists(product_id);
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
    await ensureInventoryExists(product_id);
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
    await ensureInventoryExists(product_id);
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
      const { rows: ck } = await query('SELECT entradas_cajas FROM inventory WHERE product_id = ?', [adj.product_id]);
      const curCajas = parseFloat(ck[0]?.entradas_cajas) || 0;
      updates.push({ sql: 'UPDATE inventory SET entradas_cajas = ? WHERE product_id = ?', params: [Math.max(0, curCajas - cajasChange), adj.product_id] });
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

app.put('/api/inventory/adjustments/:id', async (req, res) => {
  const { id } = req.params;
  const { warehouse, weight_change, cajas_change } = req.body;
  try {
    validateRequired(req.body, ['warehouse']);
    const { rows } = await query('SELECT * FROM stock_adjustments WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ajuste no encontrado' });
    const old = rows[0];

    const oldWeight = parseFloat(old.weight_change) || 0;
    const oldCajas = parseInt(old.cajas_change) || 0;
    const newWeight = parseFloat(weight_change) || 0;
    const newCajas = parseInt(cajas_change) || 0;

    const updates = [];
    const bodegaCol = old.bodega_col;

    // Reverse old values
    if (oldWeight > 0) {
      updates.push({ sql: `UPDATE inventory SET ${bodegaCol} = ${bodegaCol} - ? WHERE product_id = ?`, params: [oldWeight, old.product_id] });
    }
    if (oldCajas > 0) {
      const { rows: ck } = await query('SELECT entradas_cajas FROM inventory WHERE product_id = ?', [old.product_id]);
      const curCajas = parseFloat(ck[0]?.entradas_cajas) || 0;
      updates.push({ sql: 'UPDATE inventory SET entradas_cajas = ? WHERE product_id = ?', params: [Math.max(0, curCajas - oldCajas), old.product_id] });
    }

    // Apply new values
    const targetCol = warehouse === 'Ransa' ? 'bodega_1' : warehouse === 'Soyapango' ? 'bodega_2' : warehouse === 'Usulután' ? 'bodega_3' : warehouse === 'Lomas de San Francisco' ? 'bodega_4' : null;
    if (!targetCol) return res.status(400).json({ error: 'Bodega inválida' });

    if (newWeight > 0) {
      updates.push({ sql: `UPDATE inventory SET ${targetCol} = ${targetCol} + ? WHERE product_id = ?`, params: [newWeight, old.product_id] });
    }
    if (newCajas > 0) {
      updates.push({ sql: 'UPDATE inventory SET entradas_cajas = entradas_cajas + ? WHERE product_id = ?', params: [newCajas, old.product_id] });
    }

    updates.push({
      sql: 'UPDATE stock_adjustments SET warehouse = ?, bodega_col = ?, weight_change = ?, cajas_change = ? WHERE id = ?',
      params: [warehouse, targetCol, newWeight, newCajas, id]
    });

    await runTransaction(updates);

    const { rows: pRows } = await query('SELECT name FROM products WHERE id = ?', [old.product_id]);
    const pName = pRows[0]?.name || `Producto #${old.product_id}`;
    await logActivity({
      role: req.headers['x-role'] || 'desconocido',
      action: 'EDITAR AJUSTE',
      entity: 'inventory',
      product_name: pName,
      quantity: newWeight || newCajas,
      unit: warehouse === 'Ransa' ? 'KG' : 'Lbs',
      location: warehouse,
      details: `Ajuste #${id} editado: ${oldWeight}→${newWeight} ${warehouse === 'Ransa' ? 'KG' : 'Lbs'}, cajas ${oldCajas}→${newCajas}`
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/inventory/adjustments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await query('SELECT * FROM stock_adjustments WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ajuste no encontrado' });
    const adj = rows[0];
    const weightChange = parseFloat(adj.weight_change) || 0;
    const cajasChange = parseInt(adj.cajas_change) || 0;

    const updates = [];
    if (weightChange > 0) {
      const { rows: check } = await query(`SELECT ${adj.bodega_col} FROM inventory WHERE product_id = ?`, [adj.product_id]);
      const current = parseFloat(check[0]?.[adj.bodega_col]) || 0;
      const revert = Math.min(weightChange, current);
      updates.push({ sql: `UPDATE inventory SET ${adj.bodega_col} = ${adj.bodega_col} - ? WHERE product_id = ?`, params: [revert, adj.product_id] });
    }
    if (cajasChange > 0) {
      const { rows: ck } = await query('SELECT entradas_cajas FROM inventory WHERE product_id = ?', [adj.product_id]);
      const curCajas = parseFloat(ck[0]?.entradas_cajas) || 0;
      updates.push({ sql: 'UPDATE inventory SET entradas_cajas = ? WHERE product_id = ?', params: [Math.max(0, curCajas - cajasChange), adj.product_id] });
    }
    updates.push({ sql: 'DELETE FROM stock_adjustments WHERE id = ?', params: [id] });

    await runTransaction(updates);

    const { rows: pRows } = await query('SELECT name FROM products WHERE id = ?', [adj.product_id]);
    const pName = pRows[0]?.name || `Producto #${adj.product_id}`;
    await logActivity({
      role: req.headers['x-role'] || 'desconocido',
      action: 'ELIMINAR AJUSTE',
      entity: 'inventory',
      product_name: pName,
      quantity: weightChange || cajasChange,
      unit: adj.warehouse === 'Ransa' ? 'KG' : 'Lbs',
      location: adj.warehouse,
      details: `Ajuste #${id} eliminado: -${weightChange} ${adj.warehouse === 'Ransa' ? 'KG' : 'Lbs'}, -${cajasChange} cajas`
    });

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
      SELECT p.code, p.name, i.initial_stock, i.sold_stock, i.bodega_1, i.bodega_2, i.bodega_3, i.bodega_4, i.entradas_cajas, i.salidas_cajas
      FROM products p
      JOIN inventory i ON p.id = i.product_id
      ORDER BY CAST(p.code AS INTEGER) ASC
    `);
    for (const r of rows) {
      r.final_stock = (r.bodega_1 || 0) + (r.bodega_2 || 0) + (r.bodega_3 || 0) + (r.bodega_4 || 0);
      r.stock_cajas = (r.entradas_cajas || 0) - (r.salidas_cajas || 0);
    }
    res.json(rows);
  } catch (err) {
    console.error('Error fetching inventory status:', err.message);
    res.json([]);
  }
});

app.get('/api/reports/agro-sales', async (req, res) => {
  try {
    const { rows: sales } = await query(`
      SELECT a.name as agro_name, s.amount_received, s.date
      FROM sales s
      JOIN agros a ON s.agro_id = a.id
    `);
    const agg = {};
    for (const s of sales) {
      const key = s.agro_name;
      if (!agg[key]) agg[key] = { agro_name: key, total_sales: 0 };
      agg[key].total_sales += parseFloat(s.amount_received) || 0;
    }
    res.json(Object.values(agg));
  } catch (err) {
    console.error('Error fetching agro sales:', err.message);
    res.json([]);
  }
});

app.get('/api/products', async (req, res) => {
  const { rows } = await query(`
    SELECT p.*, 
           i.bodega_1 as stock_kg,
           i.bodega_4 as stock_b4,
           i.bodega_2 as stock_b2,
           i.bodega_3 as stock_b3,
           i.entradas_cajas,
           i.salidas_cajas
    FROM products p
    LEFT JOIN inventory i ON p.id = i.product_id
    ORDER BY CAST(p.code AS INTEGER) ASC
  `);
  for (const r of rows) {
    r.stock_cajas = (r.entradas_cajas || 0) - (r.salidas_cajas || 0);
  }
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
     await ensureInventoryExists(product_id);
     validateRequired(req.body, ['product_id', 'origin', 'destination', 'weight']);
     
     // Define warehouse to column mapping and their respective units
     const warehouseInfo = {
       'Ransa': { col: 'bodega_1', unit: 'KG' },
       'Central de abasto - Soyapango (Cuarto Frío)': { col: 'bodega_2', unit: 'Lbs' },
       'Soyapango': { col: 'bodega_2', unit: 'Lbs' },
       'Central de abasto - Usulután (Cuarto Frío)': { col: 'bodega_3', unit: 'Lbs' },
       'Usulután': { col: 'bodega_3', unit: 'Lbs' },
       'Lomas de San Francisco': { col: 'bodega_4', unit: 'Lbs' }
     };
     
     const originInfo = warehouseInfo[origin];
     const destInfo = warehouseInfo[destination];
     
     if (!originInfo || !destInfo) {
       return res.status(400).json({ error: 'Origen o destino inválido' });
     }

     let deductWeightKg = 0; // Weight to deduct from origin in KG
     let addWeightKg = 0;    // Weight to add to destination in KG
     
     if (unit_type === 'Cajas') {
       // Handle box transfers - need to convert boxes to weight based on product
       const boxCount = parseInt(weight) || 0;
       if (boxCount <= 0) {
         return res.status(400).json({ error: 'La cantidad de cajas debe ser mayor que 0' });
       }
       
       // Get product weight per box to convert boxes to weight
       const { rows: productRows } = await query('SELECT price_per_box FROM products WHERE id = ?', [product_id]);
       const weightPerBoxKg = productRows[0]?.price_per_box ? parseFloat(productRows[0].price_per_box) / 2.20462 : 0; // Convert lbs to kg
       
       if (weightPerBoxKg <= 0) {
         return res.status(400).json({ error: 'No se puede determinar el peso por caja del producto' });
       }
       
       const totalWeightKg = boxCount * weightPerBoxKg;
       deductWeightKg = totalWeightKg;
       addWeightKg = totalWeightKg;
       
       // Update box counters
       await query('UPDATE inventory SET salidas_cajas = salidas_cajas + ? WHERE product_id = ?', [boxCount, product_id]);
     } else {
       // Handle weight transfers
       const originWeightProvided = origin_weight !== undefined && origin_weight !== null && origin_weight !== '';
       const destWeightProvided = dest_weight !== undefined && dest_weight !== null && dest_weight !== '';
       
       // Determine weights based on what's provided
       let weightValueKg = 0;
       
       if (originWeightProvided && destWeightProvided) {
         // Both weights provided - use them directly with conversion to KG
         const originWeightNum = parseFloat(origin_weight);
         const destWeightNum = parseFloat(dest_weight);
         
         // Convert to KG based on origin unit
         if (originInfo.unit === 'KG') {
           weightValueKg = originWeightNum;
         } else { // Lbs
           weightValueKg = originWeightNum / 2.20462;
         }
         
         // Verify the dest weight matches (within tolerance for conversion)
         const expectedDestWeightKg = weightValueKg;
         const actualDestWeightKg = destInfo.unit === 'KG' ? destWeightNum : destWeightNum / 2.20462;
         
         if (Math.abs(expectedDestWeightKg - actualDestWeightKg) > 0.01) {
           return res.status(400).json({ error: 'Los pesos de origen y destino no son consistentes' });
         }
       } else if (originWeightProvided) {
         // Only origin weight provided
         const originWeightNum = parseFloat(origin_weight);
         if (originInfo.unit === 'KG') {
           weightValueKg = originWeightNum;
         } else { // Lbs
           weightValueKg = originWeightNum / 2.20462;
         }
       } else if (destWeightProvided) {
         // Only dest weight provided
         const destWeightNum = parseFloat(dest_weight);
         if (destInfo.unit === 'KG') {
           weightValueKg = destWeightNum;
         } else { // Lbs
           weightValueKg = destWeightNum / 2.20462;
         }
       } else {
         // Only general weight provided - treat as origin weight
         const weightNum = parseFloat(weight);
         if (originInfo.unit === 'KG') {
           weightValueKg = weightNum;
         } else { // Lbs
           weightValueKg = weightNum / 2.20462;
         }
       }
       
       deductWeightKg = weightValueKg;
       addWeightKg = weightValueKg;
       
       // Verify sufficient stock in origin (convert to origin unit for comparison)
       const { rows: check } = await query(`SELECT ${originInfo.col} FROM inventory WHERE product_id = ?`, [product_id]);
       const currentInOriginUnit = parseFloat(check[0]?.[originInfo.col]) || 0;
       const currentInKg = originInfo.unit === 'KG' ? currentInOriginUnit : currentInOriginUnit / 2.20462;
       
       if (currentInKg < deductWeightKg) {
         const currentDisplay = originInfo.unit === 'KG' ? currentInOriginUnit : currentInOriginUnit;
         const neededDisplay = originInfo.unit === 'KG' ? deductWeightKg * 2.20462 : deductWeightKg;
         return res.status(400).json({ 
           error: `Stock insuficiente en origen: tiene ${currentDisplay.toFixed(2)} ${originInfo.unit}, necesita ${neededDisplay.toFixed(2)} ${originInfo.unit}` 
         });
       }
     }

     // Prepare inventory updates
     const updates = [];
     
     // Deduct from origin
     if (originInfo.unit === 'KG') {
       updates.push({ sql: `UPDATE inventory SET ${originInfo.col} = ${originInfo.col} - ? WHERE product_id = ?`, params: [deductWeightKg, product_id] });
     } else { // Lbs
       updates.push({ sql: `UPDATE inventory SET ${originInfo.col} = ${originInfo.col} - ? WHERE product_id = ?`, params: [deductWeightKg * 2.20462, product_id] });
     }
     
     // Add to destination
     if (destInfo.unit === 'KG') {
       updates.push({ sql: `UPDATE inventory SET ${destInfo.col} = ${destInfo.col} + ? WHERE product_id = ?`, params: [addWeightKg, product_id] });
     } else { // Lbs
       updates.push({ sql: `UPDATE inventory SET ${destInfo.col} = ${destInfo.col} + ? WHERE product_id = ?`, params: [addWeightKg * 2.20462, product_id] });
     }
     
     // Record movement
     const originWeightForLog = originInfo.unit === 'KG' ? deductWeightKg : deductWeightKg * 2.20462;
     const destWeightForLog = destInfo.unit === 'KG' ? addWeightKg : addWeightKg * 2.20462;
     const unitForLog = unit_type !== 'Cajas' ? (originInfo.unit === 'KG' ? 'KG' : 'Lbs') : unit_type;
     
     updates.push({
       sql: 'INSERT INTO movements (product_id, origin_warehouse, dest_warehouse, weight, type, origin_weight, dest_weight, unit_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
       params: [product_id, origin, destination, unit_type === 'Cajas' ? parseInt(weight) : originWeightForLog, 'TRANSFER', originWeightForLog, destWeightForLog, unitForLog]
     });

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
    await ensureInventoryExists(product_id);
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
  const { product_id, initial_weight, raw_weight, cut_weight, waste, storage_cost, transport_cost, labor_cost, other_costs, process_mode, dest_warehouse } = req.body;
  try {
    await ensureInventoryExists(product_id);
    validateRequired(req.body, ['product_id', 'cut_weight']);
    const initKg = initial_weight !== undefined && initial_weight !== '' ? sanitizeNumber(initial_weight, 'initial_weight') : 0;
    const rawLbs = raw_weight !== undefined && raw_weight !== '' ? sanitizeNumber(raw_weight, 'raw_weight') : 0;
    const cutLbs = sanitizeNumber(cut_weight, 'cut_weight', false);
    const wasteVal = parseFloat(waste) || (initKg > 0 ? initKg * 2.20462 - cutLbs : 0);

    const updates = [
      { sql: 'INSERT INTO production_logs (product_id, initial_weight, raw_weight, cut_weight, waste, storage_cost, transport_cost, labor_cost, other_costs, dest_warehouse) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', params: [product_id, initKg, rawLbs, cutLbs, wasteVal, storage_cost || 0, transport_cost || 0, labor_cost || 0, other_costs || 0, process_mode === 'direct' ? (dest_warehouse || 'Soyapango') : 'Central de abasto - Soyapango (Cuarto Frío)'] }
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

// POST /api/production/logs/batch — carrito de procesado directo (múltiples pesos, un producto/destino)
app.post('/api/production/logs/batch', async (req, res) => {
  const { product_id, dest_warehouse, weights, process_mode } = req.body;
  try {
    validateRequired(req.body, ['product_id', 'dest_warehouse', 'weights']);
    if (!Array.isArray(weights) || weights.length === 0) {
      return res.status(400).json({ error: 'Debe incluir al menos un peso' });
    }
    const destColMap = {
      'Soyapango': 'bodega_2',
      'Usulután': 'bodega_3',
      'Lomas de San Francisco': 'bodega_4'
    };
    const destCol = destColMap[dest_warehouse];
    if (!destCol) return res.status(400).json({ error: 'Destino inválido' });

    let totalLbs = 0;
    const updates = [];
    for (const w of weights) {
      const lbs = sanitizeNumber(w, 'weight', false);
      if (lbs <= 0) continue;
      totalLbs += lbs;
      updates.push({
        sql: 'INSERT INTO production_logs (product_id, initial_weight, raw_weight, cut_weight, waste, dest_warehouse) VALUES (?, 0, 0, ?, 0, ?)',
        params: [product_id, lbs, dest_warehouse]
      });
      updates.push({
        sql: 'INSERT INTO movements (product_id, origin_warehouse, dest_warehouse, weight, type) VALUES (?, ?, ?, ?, ?)',
        params: [product_id, 'Proceso directo', dest_warehouse, lbs, 'INCOME']
      });
    }
    if (totalLbs <= 0) return res.status(400).json({ error: 'Todos los pesos son inválidos' });

    updates.push({ sql: `UPDATE inventory SET ${destCol} = ${destCol} + ? WHERE product_id = ?`, params: [totalLbs, product_id] });
    await runTransaction(updates);

    const { rows: pRows } = await query('SELECT name FROM products WHERE id = ?', [product_id]);
    const pName = pRows[0]?.name || `Producto #${product_id}`;
    await logActivity({ role: req.headers['x-role'] || 'desconocido', action: 'PRODUCCIÓN DIRECTA (LOTE)', entity: 'production_logs', product_name: pName, quantity: totalLbs, unit: 'Lbs', location: dest_warehouse, details: `${weights.length} pesos | Total: ${totalLbs} lbs → ${dest_warehouse}` });

    res.json({ success: true, totalLbs, count: weights.length });
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
  const { initial_weight, raw_weight, cut_weight, waste } = req.body;
  try {
    validateRequired(req.body, ['cut_weight']);
    const { rows } = await query('SELECT * FROM production_logs WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Producción no encontrada' });
    const old = rows[0];
    const initKg = sanitizeNumber(initial_weight, 'initial_weight');
    const rawLbs = raw_weight !== undefined && raw_weight !== '' ? parseFloat(raw_weight) : 0;
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
      { sql: 'UPDATE production_logs SET initial_weight = ?, raw_weight = ?, cut_weight = ?, waste = ? WHERE id = ?', params: [initKg, rawLbs, cutLbs, wasteVal, id] }
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
    const info = await query(`
      INSERT INTO food_costing (product_id, gross_weight, gross_cost, cooked_weight, json_data, date)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [product_id, gross_weight, gross_cost, cooked_weight, json_data, new Date().toISOString()]);

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
    // Ensure inventory exists for each product — all values start at 0
    const { rows: prods } = await query('SELECT id, code FROM products');
    for (const p of prods) {
      await query(`
        INSERT INTO inventory (product_id, bodega_1, bodega_2, bodega_3, bodega_4, initial_stock, current_stock, sold_stock)
        VALUES (?, 0, 0, 0, 0, 0, 0, 0)
        ON CONFLICT(product_id) DO NOTHING
      `, [p.id]);
    }

    res.json({ success: true, message: 'Catálogo sincronizado (inventario en cero)' });
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





// Fallback to index.html for SPA (solo en local/Render, Vercel maneja sus propias rutas)
if (!process.env.VERCEL) {
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'));
  });

  // Initialize database and run migration
  db.init().then(() => {
    initDb().then(() => {
      migrateDatabase().then(async () => {
        app.listen(port, '0.0.0.0', () => {
          console.log(`Server running at port ${port}`);
          console.log('All changes applied: New locations, stock levels, and deduction logic');

          if (!process.env.RENDER) {
            const DEPLOY_HOOK = process.env.RENDER_DEPLOY_HOOK_URL;
            if (DEPLOY_HOOK) {
              fetch(DEPLOY_HOOK, { method: 'POST' }).then(r => {
                if (r.ok) console.log('🚀 Render deploy triggered via webhook');
                else console.warn('⚠️ Render webhook responded', r.status);
              }).catch(e => console.warn('⚠️ Render webhook error:', e.message));
            }
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
  }).catch(err => {
    console.error('DB initialization failed:', err);
    process.exit(1);
  });
}

export default app;
export { initDb, migrateDatabase };
