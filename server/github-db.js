/// <reference types="sql.js" />
import initSqlJs from 'sql.js';
import * as XLSX from 'xlsx';
import { readFile } from 'fs/promises';
import { Buffer } from 'buffer';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'JairoNP300';
const REPO = 'Inventario';
const DATA_PATH = 'data/data.json';
const EXCEL_PATH = 'data/sistema.xlsx';

let db = null;
let dirty = false;
let syncPromise = null;

// GitHub API
async function gh(method, path, body = null) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'inventario-app'
    },
    body: body ? JSON.stringify(body) : null
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`GitHub ${res.status}: ${err.slice(0,200)}`);
  }
  if (res.status === 404) return null;
  return res.json();
}

const TABLE_NAMES = [
  'products','agros','inventory','movements','activity_log',
  'production_logs','ransa_requests','dispatches','sales',
  'orders','food_costing','stock_adjustments'
];

const TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, code TEXT, name TEXT, category TEXT, price_per_lb REAL DEFAULT 0, price_per_kg REAL DEFAULT 0, price_per_box REAL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS agros (id INTEGER PRIMARY KEY, name TEXT UNIQUE);
  CREATE TABLE IF NOT EXISTS inventory (product_id INTEGER PRIMARY KEY, bodega_1 REAL DEFAULT 0, bodega_2 REAL DEFAULT 0, bodega_3 REAL DEFAULT 0, bodega_4 REAL DEFAULT 0, initial_stock REAL DEFAULT 0, current_stock REAL DEFAULT 0, sold_stock REAL DEFAULT 0, final_stock REAL DEFAULT 0, cajas REAL DEFAULT 0, entradas_cajas REAL DEFAULT 0, salidas_cajas REAL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS movements (id INTEGER PRIMARY KEY, product_id INTEGER, origin_warehouse TEXT, dest_warehouse TEXT, weight REAL, type TEXT, date TEXT, origin_weight REAL DEFAULT 0, dest_weight REAL DEFAULT 0, unit_type TEXT DEFAULT 'Lbs');
  CREATE TABLE IF NOT EXISTS activity_log (id INTEGER PRIMARY KEY, role TEXT, action TEXT, entity TEXT, details TEXT, product_name TEXT, quantity REAL, unit TEXT, location TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS production_logs (id INTEGER PRIMARY KEY, product_id INTEGER, initial_weight REAL, cut_weight REAL, waste REAL, storage_cost REAL DEFAULT 0, transport_cost REAL DEFAULT 0, labor_cost REAL DEFAULT 0, other_costs REAL DEFAULT 0, warehouse TEXT DEFAULT 'Bodega 2', date TEXT, raw_weight REAL DEFAULT 0, dest_warehouse TEXT DEFAULT '');
  CREATE TABLE IF NOT EXISTS ransa_requests (id INTEGER PRIMARY KEY, product_id INTEGER, tag_weight REAL, scale_weight REAL, units_per_box INTEGER, unit_type TEXT DEFAULT 'Kg', distribution_details TEXT, date TEXT);
  CREATE TABLE IF NOT EXISTS dispatches (id INTEGER PRIMARY KEY, product_id INTEGER, agro_id INTEGER, weight REAL, unit_type TEXT DEFAULT 'Lbs', value REAL, date TEXT, discount_percent REAL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY, agro_id INTEGER, amount_received REAL, date TEXT);
  CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, product_id INTEGER, requested_qty REAL, unit_type TEXT DEFAULT 'Lbs', status TEXT DEFAULT 'PENDING', date TEXT);
  CREATE TABLE IF NOT EXISTS food_costing (id INTEGER PRIMARY KEY, date TEXT, event_name TEXT, details TEXT, product_id INTEGER, gross_weight REAL DEFAULT 0, gross_cost REAL DEFAULT 0, cooked_weight REAL DEFAULT 0, json_data TEXT);
  CREATE TABLE IF NOT EXISTS stock_adjustments (id INTEGER PRIMARY KEY, product_id INTEGER, warehouse TEXT, bodega_col TEXT, weight_change REAL DEFAULT 0, cajas_change INTEGER DEFAULT 0, role TEXT, created_at TEXT);
`;

export async function init() {
  // Load sql.js WASM binary — try local path first, then fetch from CDN
  let wasmBinary;
  try {
    const { fileURLToPath } = await import('url');
    const { join } = await import('path');
    const localPath = join(fileURLToPath(new URL('.', import.meta.url)), 'sql-wasm.wasm');
    wasmBinary = await readFile(localPath);
  } catch {
    const resp = await fetch('https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/sql-wasm.wasm');
    wasmBinary = new Uint8Array(await resp.arrayBuffer());
  }
  const SQL = await initSqlJs({ wasmBinary });
  db = new SQL.Database();
  db.run('PRAGMA journal_mode=MEMORY');

  // Create tables
  db.run(TABLE_SCHEMA);
  console.log('Tablas creadas');

  // Load data from GitHub if available
  const file = await gh('GET', DATA_PATH);
  if (file) {
    const raw = Buffer.from(file.content, 'base64').toString('utf-8');
    const data = JSON.parse(raw);
    for (const table of TABLE_NAMES) {
      const rows = data[table] || [];
      if (rows.length === 0) continue;
      const cols = Object.keys(rows[0]);
      const q = cols.map(() => '?').join(',');
      // Replace INTO with OR REPLACE to handle conflicts
      // We use INSERT and just ignore errors on conflict for initial load
      const stmt = db.prepare(`INSERT OR IGNORE INTO ${table} (${cols.join(',')}) VALUES (${q})`);
      for (const row of rows) {
        stmt.run(cols.map(c => row[c]));
      }
      stmt.free();
    }
    console.log(`✅ Cargados datos desde GitHub: ${TABLE_NAMES.filter(t => (data[t]||[]).length > 0).join(', ')}`);
  } else {
    console.log('📭 No hay data.json en GitHub, BD vacía');
  }
}

export async function query(sql, params = []) {
  if (!db) throw new Error('DB no inicializada');

  // Convert $1, $2, etc to ? for SQLite, and strip PostgreSQL RETURNING
  const cleanSql = sql
    .replace(/\$\d+/g, '?')
    .replace(/\s+RETURNING\s+\w+/gi, '');

  if (/^\s*(SELECT|WITH|PRAGMA)/i.test(cleanSql)) {
    const stmt = db.prepare(cleanSql);
    if (params.length > 0) stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return { rows, lastInsertRowid: null };
  }

  // INSERT/UPDATE/DELETE/CREATE/ALTER
  db.run(cleanSql, params);
  dirty = true;

  let lastInsertRowid = null;
  if (/^\s*INSERT\s/i.test(cleanSql)) {
    try {
      const r = db.exec('SELECT last_insert_rowid()');
      if (r.length > 0 && r[0].values.length > 0) lastInsertRowid = r[0].values[0][0];
    } catch (e) { /* ignore */ }
  }
  return { rows: [], lastInsertRowid };
}

export async function exec(rawSql) {
  if (!db) throw new Error('DB no inicializada');
  // Convert SQLite-specific syntax
  const sql = rawSql
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'INTEGER PRIMARY KEY')
    .replace(/strftime\('%Y-%m', s\.date\)/gi, "strftime('%Y-%m', s.date)");
  db.run(sql);
  dirty = true;
  return { rows: [] };
}

export async function syncToGitHub() {
  if (!dirty || syncPromise) return syncPromise;
  dirty = false;
  syncPromise = doSync();
  try { await syncPromise; } finally { syncPromise = null; }
}

async function doSync() {
  if (!GITHUB_TOKEN) return;
  const data = {};
  for (const table of TABLE_NAMES) {
    try {
      const res = db.exec(`SELECT * FROM ${table}`);
      if (res.length > 0) {
        const cols = res[0].columns;
        data[table] = res[0].values.map(v => {
          const obj = {};
          cols.forEach((c, i) => { obj[c] = v[i]; });
          return obj;
        });
      } else data[table] = [];
    } catch (e) { data[table] = []; }
  }

  // Update data.json
  const json = JSON.stringify(data, null, 2);
  const jsonB64 = Buffer.from(json, 'utf-8').toString('base64');

  let js = await gh('GET', DATA_PATH);
  await gh('PUT', DATA_PATH, {
    message: `Auto-sync: ${new Date().toISOString().slice(0,16)}`,
    content: jsonB64,
    sha: js ? js.sha : null
  });

  // Generate and save Excel
  try {
    const wb = XLSX.utils.book_new();
    for (const table of TABLE_NAMES) {
      const rows = data[table] || [];
      if (rows.length > 0) {
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, table.slice(0, 31));
      }
    }
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const exB64 = Buffer.from(buf).toString('base64');
    let ex = await gh('GET', EXCEL_PATH);
    await gh('PUT', EXCEL_PATH, {
      message: `Auto-sync Excel: ${new Date().toISOString().slice(0,16)}`,
      content: exB64,
      sha: ex ? ex.sha : null
    });
  } catch (e) {
    console.warn('Excel sync error:', e.message);
  }
}
