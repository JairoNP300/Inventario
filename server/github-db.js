/// <reference types="sql.js" />
import initSqlJs from 'sql.js';
import ExcelJS from 'exceljs';
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
  if (!GITHUB_TOKEN) return null;
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
    const localPath = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
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

  // Generate and save Excel with structured formatting
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sistema Ventas e Inventario';
    wb.created = new Date();

    // ─── Sheet 1: Resumen de Inventario ───
    const invSheet = wb.addWorksheet('Resumen Inventario', { views: [{ state: 'frozen', ySplit: 1 }] });
    const invColumns = [
      { header: 'Código', key: 'code', width: 12 },
      { header: 'Producto', key: 'name', width: 45 },
      { header: 'Ransa (KG)', key: 'bodega_1', width: 14 },
      { header: 'Soyapango (Lbs)', key: 'bodega_2', width: 18 },
      { header: 'Usulután (Lbs)', key: 'bodega_3', width: 18 },
      { header: 'Lomas (Lbs)', key: 'bodega_4', width: 14 },
      { header: 'Stock Total (Lbs)', key: 'total_lbs', width: 18 },
      { header: 'Cajas Entradas', key: 'cajas_in', width: 15 },
      { header: 'Cajas Salidas', key: 'cajas_out', width: 14 },
      { header: 'Stock Cajas', key: 'stock_cajas', width: 13 }
    ];
    invSheet.columns = invColumns;

    const prods = data.products || [];
    const inv = data.inventory || [];
    const invRows = [];
    for (const p of prods) {
      const invRow = inv.find(i => i.product_id === p.id) || {};
      const b1 = parseFloat(invRow.bodega_1) || 0;
      const b2 = parseFloat(invRow.bodega_2) || 0;
      const b3 = parseFloat(invRow.bodega_3) || 0;
      const b4 = parseFloat(invRow.bodega_4) || 0;
      const totalLbs = b1 * 2.20462 + b2 + b3 + b4;
      const cajasIn = parseFloat(invRow.entradas_cajas) || 0;
      const cajasOut = parseFloat(invRow.salidas_cajas) || 0;
      invRows.push({
        code: p.code,
        name: p.name,
        bodega_1: parseFloat(b1.toFixed(2)),
        bodega_2: parseFloat(b2.toFixed(2)),
        bodega_3: parseFloat(b3.toFixed(2)),
        bodega_4: parseFloat(b4.toFixed(2)),
        total_lbs: parseFloat(totalLbs.toFixed(2)),
        cajas_in: cajasIn,
        cajas_out: cajasOut,
        stock_cajas: cajasIn - cajasOut
      });
    }
    invRows.sort((a, b) => (a.code || '').localeCompare(b.code, undefined, { numeric: true }));
    invRows.forEach(r => invSheet.addRow(r));

    // Header style
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    };
    invSheet.getRow(1).eachCell(cell => { cell.style = headerStyle; });
    invSheet.getRow(1).height = 22;

    // Data rows style
    const dataStyle = { alignment: { horizontal: 'center', vertical: 'middle' } };
    invSheet.eachRow((row, rowNum) => {
      if (rowNum > 1) {
        row.eachCell(cell => { cell.style = { ...cell.style, ...dataStyle }; });
      }
    });

    // ─── Raw data sheets ───
    const tableLabels = {
      products: 'Productos',
      agros: 'Agros',
      inventory: 'Inventario Raw',
      movements: 'Movimientos',
      activity_log: 'Actividad',
      production_logs: 'Produccion',
      ransa_requests: 'Recepciones',
      dispatches: 'Despachos',
      sales: 'Ventas',
      orders: 'Pedidos',
      food_costing: 'Comidas',
      stock_adjustments: 'Ajustes Stock'
    };

    for (const table of TABLE_NAMES) {
      const rows = data[table] || [];
      if (rows.length === 0) continue;
      const label = tableLabels[table] || table.slice(0, 31);
      const ws = wb.addWorksheet(label, { views: [{ state: 'frozen', ySplit: 1 }] });
      const keys = Object.keys(rows[0]);
      ws.columns = keys.map(k => ({ header: k, key: k, width: Math.min(Math.max(k.length * 2, 12), 35) }));
      ws.addRows(rows);
      ws.getRow(1).eachCell(cell => { cell.style = headerStyle; });
      ws.getRow(1).height = 20;
    }

    const buf = await wb.xlsx.writeBuffer();
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
