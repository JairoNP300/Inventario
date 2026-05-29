import * as jdb from './json-db.js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { Buffer } from 'buffer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_DATA_PATH = join(__dirname, '..', 'data', 'data.json');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'JairoNP300';
const REPO = 'Inventario';
const DATA_PATH = 'data/data.json';
const EXCEL_PATH = 'data/sistema.xlsx';

let dirty = false;
let syncPromise = null;

const TABLE_NAMES = [
  'products','agros','inventory','movements','activity_log',
  'production_logs','ransa_requests','dispatches','sales',
  'orders','food_costing','stock_adjustments'
];

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

export async function init() {
  try {
    const localRaw = await readFile(LOCAL_DATA_PATH, 'utf-8');
    const localData = JSON.parse(localRaw);
    jdb.loadData(localData);
    console.log('Datos cargados desde archivo local');
  } catch (e) {
    console.log('No hay data.json local, BD vacía');
  }
  syncFromGitHub().catch(e => console.warn('GitHub sync error:', e.message));
}

async function syncFromGitHub() {
  if (!GITHUB_TOKEN) return;
  const file = await gh('GET', DATA_PATH);
  if (!file) return;
  const raw = Buffer.from(file.content, 'base64').toString('utf-8');
  const data = JSON.parse(raw);
  jdb.loadData(data);
  console.log('Datos sincronizados desde GitHub');
  await doSync(true);
}

export async function query(sql, params = []) {
  dirty = true;
  return jdb.query(sql, params);
}

export async function exec(sql) {
  dirty = true;
  return jdb.exec(sql);
}

export async function syncToGitHub() {
  if (!dirty) return;
  dirty = false;
  syncPromise = doSync();
  try { await syncPromise; } finally { syncPromise = null; }
}

async function doSync(force = false) {
  if (!GITHUB_TOKEN) return;
  if (!dirty && !force) return;
  dirty = false;
  const data = jdb.getData();

  const json = JSON.stringify(data, null, 2);
  const jsonB64 = Buffer.from(json, 'utf-8').toString('base64');

  let js = await gh('GET', DATA_PATH);
  await gh('PUT', DATA_PATH, {
    message: `Auto-sync: ${new Date().toISOString().slice(0,16)}`,
    content: jsonB64,
    sha: js ? js.sha : null
  });

  try {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sistema Ventas e Inventario';
    wb.created = new Date();

    const invSheet = wb.addWorksheet('Resumen Inventario', { views: [{ state: 'frozen', ySplit: 1 }] });
    invSheet.columns = [
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
    const prods = data.products || [];
    const inv = data.inventory || [];
    for (const p of prods) {
      const invRow = inv.find(i => i.product_id === p.id) || {};
      const b1 = parseFloat(invRow.bodega_1) || 0;
      const b2 = parseFloat(invRow.bodega_2) || 0;
      const b3 = parseFloat(invRow.bodega_3) || 0;
      const b4 = parseFloat(invRow.bodega_4) || 0;
      invSheet.addRow({
        code: p.code, name: p.name,
        bodega_1: parseFloat(b1.toFixed(2)), bodega_2: parseFloat(b2.toFixed(2)),
        bodega_3: parseFloat(b3.toFixed(2)), bodega_4: parseFloat(b4.toFixed(2)),
        total_lbs: parseFloat((b1 * 2.20462 + b2 + b3 + b4).toFixed(2)),
        cajas_in: parseFloat(invRow.entradas_cajas) || 0,
        cajas_out: parseFloat(invRow.salidas_cajas) || 0,
        stock_cajas: (parseFloat(invRow.entradas_cajas) || 0) - (parseFloat(invRow.salidas_cajas) || 0)
      });
    }

    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    };
    invSheet.getRow(1).eachCell(cell => { cell.style = headerStyle; });

    const tableLabels = {
      products: 'Productos', agros: 'Agros', inventory: 'Inventario Raw',
      movements: 'Movimientos', activity_log: 'Actividad', production_logs: 'Produccion',
      ransa_requests: 'Recepciones', dispatches: 'Despachos', sales: 'Ventas',
      orders: 'Pedidos', food_costing: 'Comidas', stock_adjustments: 'Ajustes Stock'
    };
    for (const table of TABLE_NAMES) {
      const rows = data[table] || [];
      if (rows.length === 0) continue;
      const ws = wb.addWorksheet(tableLabels[table] || table, { views: [{ state: 'frozen', ySplit: 1 }] });
      ws.columns = Object.keys(rows[0]).map(k => ({ header: k, key: k, width: 20 }));
      ws.addRows(rows);
      ws.getRow(1).eachCell(cell => { cell.style = headerStyle; });
    }

    const buf = await wb.xlsx.writeBuffer();
    const exB64 = Buffer.from(buf).toString('base64');
    let ex = await gh('GET', EXCEL_PATH);
    await gh('PUT', EXCEL_PATH, {
      message: `Auto-sync Excel: ${new Date().toISOString().slice(0,16)}`,
      content: exB64, sha: ex ? ex.sha : null
    });
  } catch (e) {
    console.warn('Excel sync error:', e.message);
  }
}
