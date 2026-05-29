// Minimal JSON-backed SQL-like query engine
// Replaces sql.js — no WASM, instant cold start

let tables = {};  // { tableName: [rowObj, ...] }
let lastId = 0;
let inTransaction = false;
let backups = [];

export function loadData(json) {
  tables = {};
  for (const table of ['products','agros','inventory','movements','activity_log','production_logs','ransa_requests','dispatches','sales','orders','food_costing','stock_adjustments']) {
    tables[table] = json[table] || [];
  }
  lastId = Math.max(0, ...Object.values(tables).flat().map(r => r.id || 0));
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Simple SQL parser — handles patterns used by this app
function parseSQL(sql) {
  sql = sql.replace(/\s+/g, ' ').trim();
  let table = '', columns = '*', where = [], orderBy = null, limit = null, offset = null, join = null;
  let isDistinct = false, isSelect = false, isInsert = false, isUpdate = false, isDelete = false;

  if (/^SELECT/i.test(sql)) {
    isSelect = true;
    let rest = sql.replace(/^SELECT\s+/i, '');
    if (/^DISTINCT\s+/i.test(rest)) { isDistinct = true; rest = rest.replace(/^DISTINCT\s+/i, ''); }
    const selectMatch = rest.match(/^(.+?)\s+FROM\s+(\w+)/i);
    if (!selectMatch) return null;
    columns = selectMatch[1].trim();
    rest = rest.slice(selectMatch[0].length).trim();

    // JOIN
    const joinMatch = rest.match(/^(LEFT\s+)?JOIN\s+(\w+)\s+ON\s+(.+?)(?=\s+(WHERE|ORDER\s+BY|LIMIT|$))/i);
    if (joinMatch) {
      join = { type: joinMatch[1] || '', table: joinMatch[2], on: joinMatch[3].trim() };
      rest = rest.slice(joinMatch[0].length).trim();
    }

    // WHERE
    const whereMatch = rest.match(/^WHERE\s+(.+?)(?=\s+ORDER\s+BY\s|\s+LIMIT\s|$)/i);
    if (whereMatch) { rest = rest.slice(whereMatch[0].length).trim(); }

    // ORDER BY
    const orderMatch = rest.match(/^ORDER\s+BY\s+(.+?)(?=\s+LIMIT\s|$)/i);
    if (orderMatch) { orderBy = orderMatch[1].trim(); rest = rest.slice(orderMatch[0].length).trim(); }

    // LIMIT / OFFSET
    const limitMatch = rest.match(/^LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?/i);
    if (limitMatch) { limit = parseInt(limitMatch[1]); offset = limitMatch[2] ? parseInt(limitMatch[2]) : null; }

    if (whereMatch) where = parseWhere(whereMatch[1]);  // defer to parse where with params

    return { type: 'select', table, columns, whereConditions: whereMatch ? whereMatch[1] : null, orderBy, limit, offset, join, isDistinct, rawWhere: whereMatch?.[1] };
  }

  if (/^INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\((.+?)\)\s*/i.test(sql)) {
    const m = sql.match(/^INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\((.+?)\)\s*/i);
    return { type: 'insert', table: m[1], columns: m[2].split(',').map(c => c.trim()), values: m[3] };
  }

  if (/^UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i.test(sql)) {
    const m = sql.match(/^UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
    return { type: 'update', table: m[1], sets: m[2], whereConditions: m[3] || null };
  }

  if (/^DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/i.test(sql)) {
    const m = sql.match(/^DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/i);
    return { type: 'delete', table: m[1], whereConditions: m[2] || null };
  }

  if (/^BEGIN\b/i.test(sql)) return { type: 'begin' };
  if (/^COMMIT\b/i.test(sql)) return { type: 'commit' };
  if (/^ROLLBACK\b/i.test(sql)) return { type: 'rollback' };
  if (/^CREATE\s+TABLE/i.test(sql)) return { type: 'ddl' };
  if (/^ALTER\s+TABLE/i.test(sql)) return { type: 'ddl' };
  if (/^PRAGMA/i.test(sql)) return { type: 'pragma' };
  if (/^SELECT\s+last_insert_rowid/i.test(sql)) return { type: 'lastid' };

  return null;
}

function parseWhere(whereStr) {
  // Returns array of conditions or raw string
  return whereStr;
}

function evaluateRow(row, whereStr, params) {
  if (!whereStr) return true;
  // Replace ? with actual params
  let expr = whereStr;
  let pIndex = 0;
  expr = expr.replace(/\?/g, () => {
    const val = params[pIndex++];
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    return val;
  });
  expr = expr.replace(/\$(\d+)/g, (_, n) => {
    const val = params[parseInt(n) - 1];
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    return val;
  });

  // Replace column references (simple heuristic: avoid replacing numbers and strings)
  for (const key of Object.keys(row)) {
    const val = row[key];
    if (val === null || val === undefined) {
      expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), 'NULL');
    } else if (typeof val === 'string') {
      expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), `'${val.replace(/'/g, "''")}'`);
    } else {
      expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), val);
    }
  }

  // Handle SQL functions
  expr = expr.replace(/COALESCE\(([^,]+),(\d+)\)/g, (_, col, def) => `CASE WHEN ${col} IS NULL OR ${col} = '' THEN ${def} ELSE ${col} END`);

  // Convert SQL operators to JS
  expr = expr.replace(/\bIS\s+NOT\s+NULL\b/g, '!== null && !== undefined');
  expr = expr.replace(/\bIS\s+NULL\b/g, '=== null || === undefined');
  expr = expr.replace(/\bAND\b/g, '&&');
  expr = expr.replace(/\bOR\b/g, '||');
  expr = expr.replace(/!=/g, '!==');
  expr = expr.replace(/LIKE\s+'([^']*)'/g, (_, p) => {
    const regex = '^' + p.replace(/%/g, '.*').replace(/_/g, '.') + '$';
    return `.match(/${regex}/)`;
  });
  // IN list
  expr = expr.replace(/\bIN\s*\(([^)]+)\)/g, (_, list) => ` in (${list})`);
  expr = expr.replace(/\bNOT\s+IN\s*\(([^)]+)\)/g, (_, list) => ` !in (${list})`);

  try {
    return Function('"use strict"; return (' + expr + ')')();
  } catch (e) {
    return true; // fallback
  }
}

function evalSets(row, setStr, params) {
  const assignments = setStr.split(',').map(s => s.trim());
  for (const a of assignments) {
    const m = a.match(/^(\w+)\s*=\s*(.+)$/);
    if (!m) continue;
    const col = m[1];
    let expr = m[2];
    let pIndex = 0;
    expr = expr.replace(/\?/g, () => {
      const val = params[pIndex++];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
      return val;
    });
    expr = expr.replace(/\$(\d+)/g, (_, n) => {
      const val = params[parseInt(n) - 1];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
      return val;
    });
    for (const key of Object.keys(row)) {
      if (expr.includes(key)) {
        const val = row[key];
        expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), val === null ? '0' : val);
      }
    }
    // Convert SQL operators
    expr = expr.replace(/COALESCE\(([^,]+),(\d+)\)/g, '(($1) !== null && ($1) !== undefined ? ($1) : $2)');
    try {
      row[col] = Function('"use strict"; return (' + expr + ')')();
    } catch (e) {
      // skip
    }
  }
}

export function query(sql, params = []) {
  const parsed = parseSQL(sql);
  if (!parsed) return { rows: [], lastInsertRowid: null };

  switch (parsed.type) {
    case 'select': {
      let rows = tables[parsed.table] || [];

      // JOIN (simple LEFT JOIN)
      if (parsed.join) {
        const joinTable = tables[parsed.join.table] || [];
        const joined = [];
        for (const row of rows) {
          let matched = false;
          for (const jRow of joinTable) {
            // Simple ON condition evaluation
            const onExpr = parsed.join.on.replace(/(\w+)\.(\w+)/g, (_, t, c) => {
              if (t === parsed.table) return row[c];
              if (t === parsed.join.table) return jRow[c];
              return `${t}.${c}`;
            });
            if (evaluateRow({}, onExpr.replace(/=/g, '===') + '!==false', [])) {
              joined.push({ ...row, ...jRow });
              matched = true;
            }
          }
          if (!matched) {
            const nullRow = {};
            for (const k of Object.keys(joinTable[0] || {})) nullRow[k] = null;
            joined.push({ ...row, ...nullRow });
          }
        }
        rows = joined;
      }

      // WHERE
      if (parsed.whereConditions) {
        rows = rows.filter(r => evaluateRow(r, parsed.whereConditions, params));
      }

      // DISTINCT
      if (parsed.isDistinct) {
        const seen = new Set();
        rows = rows.filter(r => {
          const key = JSON.stringify(r);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      // ORDER BY
      if (parsed.orderBy) {
        const parts = parsed.orderBy.split(',').map(s => s.trim());
        for (const p of parts.reverse()) {
          const m = p.match(/^(\w+(?:\.\w+)?)\s*(ASC|DESC)?$/i);
          if (!m) continue;
          const col = m[1];
          const dir = (m[2] || 'ASC').toUpperCase();
          rows.sort((a, b) => {
            let va = col.includes('.') ? (col.split('.')[0] === parsed.table ? a[col.split('.')[1]] : null) : a[col];
            let vb = col.includes('.') ? (col.split('.')[0] === parsed.table ? b[col.split('.')[1]] : null) : b[col];
            if (va === null || va === undefined) va = '';
            if (vb === null || vb === undefined) vb = '';
            if (typeof va === 'string' && typeof vb === 'string') {
              const cmp = va.localeCompare(vb);
              return dir === 'DESC' ? -cmp : cmp;
            }
            return dir === 'DESC' ? (vb > va ? 1 : -1) : (va > vb ? 1 : -1);
          });
        }
      }

      // LIMIT / OFFSET
      const offset = parsed.offset || 0;
      if (parsed.limit) rows = rows.slice(offset, offset + parsed.limit);

      // Column projection
      const result = [];
      for (const row of rows) {
        if (parsed.columns === '*') {
          result.push(clone(row));
        } else {
          const obj = {};
          const cols = parsed.columns.split(',').map(c => c.trim().toLowerCase());
          for (const c of cols) {
            // Handle aliases: col as alias
            const aliasMatch = c.match(/^(.+?)\s+AS\s+(\w+)$/i);
            if (aliasMatch) {
              let colName = aliasMatch[1].trim();
              if (colName.includes('.')) colName = colName.split('.')[1];
              obj[aliasMatch[2]] = evaluateAggregate(colName, row);
            } else {
              if (c.includes('.')) {
                const parts = c.split('.');
                obj[c] = row[parts[1]];
              } else {
                obj[c] = evaluateAggregate(c, row);
              }
            }
          }
          result.push(obj);
        }
      }

      // Handle aggregate SELECT (COUNT, SUM, etc as single row)
      if (parsed.columns !== '*' && /(COUNT|SUM|COALESCE|MIN|MAX|strftime)/i.test(parsed.columns)) {
        if (result.length === 0) {
          // Return a single row with zero values
          const obj = {};
          const cols = parsed.columns.split(',').map(c => c.trim().toLowerCase());
          for (const c of cols) {
            const aliasMatch = c.match(/^(.+?)\s+AS\s+(\w+)$/i);
            const alias = aliasMatch ? aliasMatch[2] : c.split('.').pop();
            if (/COUNT/i.test(c)) obj[alias] = 0;
            else if (/SUM/i.test(c)) obj[alias] = 0;
            else if (/COALESCE/i.test(c)) {
              const m = c.match(/COALESCE\([^,]+,(\d+)\)/i);
              obj[alias] = m ? parseFloat(m[1]) : 0;
            } else obj[alias] = null;
          }
          return { rows: [obj], lastInsertRowid: null };
        }
        return { rows: result.length > 0 ? [result.reduce((a, b) => ({ ...a, ...b }))] : result, lastInsertRowid: null };
      }

      return { rows: result, lastInsertRowid: null };
    }

    case 'insert': {
      const row = {};
      let pIndex = 0;
      parsed.columns.forEach((col, i) => {
        let valExpr = parsed.values.replace(/^\(|\)$/g, '').split(',').map(s => s.trim())[i];
        if (valExpr === '?') {
          row[col] = params[pIndex++];
        } else if (/^\$(\d+)$/.test(valExpr)) {
          const n = parseInt(valExpr.match(/^\$(\d+)$/)[1]);
          row[col] = params[n - 1];
        } else if (/^'(.+)'$/.test(valExpr)) {
          row[col] = valExpr.match(/^'(.+)'$/)[1];
        } else if (valExpr === 'NULL') {
          row[col] = null;
        } else {
          row[col] = parseFloat(valExpr);
        }
      });
      if (!row.id) row.id = ++lastId;
      tables[parsed.table].push(row);
      return { rows: [], lastInsertRowid: row.id };
    }

    case 'update': {
      let count = 0;
      let rows = tables[parsed.table] || [];
      if (parsed.whereConditions) rows = rows.filter(r => evaluateRow(r, parsed.whereConditions, params));
      for (const r of rows) {
        evalSets(r, parsed.sets, params);
        count++;
      }
      return { rows: [], lastInsertRowid: null };
    }

    case 'delete': {
      if (parsed.whereConditions) {
        tables[parsed.table] = (tables[parsed.table] || []).filter(r => !evaluateRow(r, parsed.whereConditions, params));
      } else {
        tables[parsed.table] = [];
      }
      return { rows: [], lastInsertRowid: null };
    }

    case 'begin':
      inTransaction = true;
      backups.push(clone(tables));
      return { rows: [], lastInsertRowid: null };

    case 'commit':
      inTransaction = false;
      backups = [];
      return { rows: [], lastInsertRowid: null };

    case 'rollback':
      inTransaction = false;
      if (backups.length > 0) tables = backups.pop();
      return { rows: [], lastInsertRowid: null };

    case 'ddl':
    case 'pragma':
      return { rows: [], lastInsertRowid: null };

    case 'lastid':
      return { rows: [{ 'last_insert_rowid()': lastId }], lastInsertRowid: lastId };

    default:
      return { rows: [], lastInsertRowid: null };
  }
}

function evaluateAggregate(expr, row) {
  // Handle strftime
  if (/strftime/i.test(expr)) {
    const m = expr.match(/strftime\('([^']+)'\s*,\s*(\w+)\)/i);
    if (m) {
      const val = row[m[2]];
      if (!val) return '';
      const d = new Date(val);
      if (isNaN(d)) return '';
      const fmt = m[1];
      return fmt
        .replace('%Y', d.getFullYear())
        .replace('%m', String(d.getMonth() + 1).padStart(2, '0'))
        .replace('%d', String(d.getDate()).padStart(2, '0'));
    }
  }
  if (/COUNT\s*\(\*/i.test(expr)) return row._count || 1;
  if (/COUNT\s*\(/i.test(expr)) return row._count || 1;
  return row[expr.split('.').pop()] ?? null;
}

export function exec(sql) {
  query(sql);
  return { rows: [] };
}

export function getData() {
  return clone(tables);
}
