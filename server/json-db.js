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
  let table = '', tableAlias = '', columns = '*', where = [], orderBy = null, limit = null, offset = null, join = null;
  let isDistinct = false, isSelect = false, isInsert = false, isUpdate = false, isDelete = false;

  if (/^SELECT/i.test(sql)) {
    isSelect = true;
    let rest = sql.replace(/^SELECT\s+/i, '');
    if (/^DISTINCT\s+/i.test(rest)) { isDistinct = true; rest = rest.replace(/^DISTINCT\s+/i, ''); }
    const selectMatch = rest.match(/^(.+?)\s+FROM\s+(\w+)/i);
    if (!selectMatch) return null;
    columns = selectMatch[1].trim();
    table = selectMatch[2].trim();
    rest = rest.slice(selectMatch[0].length).trim();
    // Consume optional table alias (single word, not a SQL keyword)
    const aliasMatch = rest.match(/^(\w+)\s+/);
    if (aliasMatch && !/^(LEFT|RIGHT|INNER|OUTER|CROSS|JOIN|WHERE|ORDER|LIMIT|OFFSET|GROUP|HAVING)$/i.test(aliasMatch[1])) {
      tableAlias = aliasMatch[1];
      rest = rest.slice(aliasMatch[0].length).trim();
    }

    // JOIN
    const joinMatch = rest.match(/^(LEFT\s+)?JOIN\s+(\w+)(?:\s+(\w+))?\s+ON\s+(.+?)(?=\s+(WHERE|ORDER\s+BY|LIMIT|$))/i);
    if (joinMatch) {
      join = { type: joinMatch[1] || '', table: joinMatch[2], on: joinMatch[4].trim(), alias: joinMatch[3] || '' };
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

    return { type: 'select', table, tableAlias, columns, whereConditions: whereMatch ? whereMatch[1] : null, orderBy, limit, offset, join, isDistinct, rawWhere: whereMatch?.[1] };
  }

  if (/^INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\((.+?)\)\s*/i.test(sql)) {
    const m = sql.match(/^INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\((.+?)\)\s*(ON\s+CONFLICT.*)?$/i);
    const onConflict = m[4] ? m[4].trim() : null;
    let conflictCol = null;
    if (onConflict) {
      const cm = onConflict.match(/ON\s+CONFLICT\s*\((\w+)\)\s*DO\s+NOTHING/i);
      if (cm) conflictCol = cm[1];
    }
    return { type: 'insert', table: m[1], columns: m[2].split(',').map(c => c.trim()), values: m[3], conflictCol };
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
  // Manually parse simple WHERE conditions: col op val [AND/OR col op val ...]
  const exprs = whereStr.split(/\s+(AND|OR)\s+/i);
  let overall = true;
  let logic = 'AND';
  for (let i = 0; i < exprs.length; i++) {
    const expr = exprs[i].trim();
    if (/^(AND|OR)$/i.test(expr)) { logic = expr.toUpperCase(); continue; }
    const m = expr.match(/^((?:\w+\.)?\w+)\s*(=|!=|<>|>|<|>=|<=|IS\s+NOT\s+NULL|IS\s+NULL|LIKE|IN|NOT\s+IN)\s*(.*)$/i);
    if (!m) { overall = overall && true; continue; }
    let col = m[1].includes('.') ? m[1].split('.').pop() : m[1];
    let op = m[2].trim().toUpperCase().replace(/\s+/g, ' ');
    let valStr = m[3].trim();
    const actual = row[col];
    let result = true;
    if (op === 'IS NULL') result = (actual === null || actual === undefined);
    else if (op === 'IS NOT NULL') result = (actual !== null && actual !== undefined);
    else {
      // Replace ? and $N with actual params
      let pIdx = 0;
      const paramStr = valStr.replace(/\?/g, () => {
        const v = params[pIdx++];
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'string') return "'" + v.replace(/'/g, "''") + "'";
        return String(v);
      });
      valStr = paramStr.replace(/\$(\d+)/g, (_, n) => {
        const v = params[parseInt(n) - 1];
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'string') return "'" + v.replace(/'/g, "''") + "'";
        return String(v);
      });
      // Get expected value
      let expected;
      if (valStr === 'NULL') expected = null;
      else if (/^'([^']*)'$/.test(valStr)) expected = valStr.match(/^'([^']*)'$/)[1];
      else expected = parseFloat(valStr);
      if (op === 'LIKE') {
        const pattern = new RegExp('^' + expected.replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');
        result = pattern.test(String(actual));
      } else if (op === 'IN') {
        const list = valStr.slice(1, -1).split(',').map(s => s.trim().replace(/^'(.*)'$/, '$1'));
        result = list.includes(String(actual));
      } else if (op === 'NOT IN') {
        const list = valStr.slice(1, -1).split(',').map(s => s.trim().replace(/^'(.*)'$/, '$1'));
        result = !list.includes(String(actual));
      } else if (op === '=') result = actual == expected;
      else if (op === '!=' || op === '<>') result = actual != expected;
      else if (op === '>') result = parseFloat(actual) > parseFloat(expected);
      else if (op === '<') result = parseFloat(actual) < parseFloat(expected);
      else if (op === '>=') result = parseFloat(actual) >= parseFloat(expected);
      else if (op === '<=') result = parseFloat(actual) <= parseFloat(expected);
    }
    if (logic === 'AND') overall = overall && result;
    else overall = overall || result;
  }
  return overall;
}

function evalSets(row, setStr, params) {
  const assignments = setStr.split(',').map(s => s.trim());
  let pIndex = 0;
  for (const a of assignments) {
    const m = a.match(/^(\w+)\s*=\s*(.+)$/);
    if (!m) continue;
    const col = m[1];
    let valExpr = m[2].trim();
    valExpr = valExpr.replace(/\?/g, () => {
      const v = params[pIndex++];
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'string') return "'" + v.replace(/'/g, "''") + "'";
      return String(v);
    });
    valExpr = valExpr.replace(/\$(\d+)/g, (_, n) => {
      const v = params[parseInt(n) - 1];
      return v === null || v === undefined ? 'NULL' : v;
    });
    let val;
    if (valExpr === 'NULL') val = null;
    else if (/^'([^']*)'$/.test(valExpr)) val = valExpr.match(/^'([^']*)'$/)[1];
    else if (/^COALESCE\s*\(\s*(.+?)\s*,\s*(\d+)\s*\)$/i.test(valExpr)) {
      const cm = valExpr.match(/^COALESCE\s*\(\s*(.+?)\s*,\s*(\d+)\s*\)$/i);
      const rv = row[cm[1].trim()];
      val = (rv !== null && rv !== undefined && rv !== '') ? parseFloat(rv) : parseFloat(cm[2]);
    } else {
      val = parseFloat(valExpr);
    }
    row[col] = val;
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
            // Simple ON condition evaluation: replace t.col with actual values
            const onExpr = parsed.join.on.replace(/(\w+)\.(\w+)/g, (_, t, c) => {
              if (t === parsed.table || t === parsed.tableAlias) return JSON.stringify(row[c]);
              if (t === parsed.join.table || t === parsed.join.alias) return JSON.stringify(jRow[c]);
              return JSON.stringify(t + '.' + c);
            });
            // After replacement, onExpr is something like "5" = "1" — compare simply
            const eqMatch = onExpr.match(/^\s*(.+?)\s*=\s*(.+?)\s*$/);
            if (eqMatch) {
              try {
                const a = JSON.parse(eqMatch[1]);
                const b = JSON.parse(eqMatch[2]);
                if (a == b) {
                  joined.push({ ...row, ...jRow });
                  matched = true;
                }
              } catch(e) { /* skip bad ON */ }
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

      // Detect if query has aggregate functions
      const isAggregate = parsed.columns !== '*' && /(COUNT|SUM|COALESCE|MIN|MAX|strftime)/i.test(parsed.columns);

      // Column projection
      const result = [];
      const aggExprs = [];  // [{alias, expr, type}]
      if (isAggregate) {
        const cols = parsed.columns.split(',').map(c => c.trim().toLowerCase());
        for (const c of cols) {
          const aliasMatch = c.match(/^(.+?)\s+AS\s+(\w+)$/i);
          const rawExpr = aliasMatch ? aliasMatch[1].trim() : c;
          const alias = aliasMatch ? aliasMatch[2] : c.split('.').pop();
          let type = 'raw';
          if (/^COUNT\s*\(\*/i.test(rawExpr)) type = 'count_star';
          else if (/^COUNT\s*\(/i.test(rawExpr)) type = 'count';
          else if (/^SUM\s*\(/i.test(rawExpr)) type = 'sum';
          else if (/^COALESCE\s*\(/i.test(rawExpr)) type = 'coalesce';
          else if (/^MIN\s*\(/i.test(rawExpr)) type = 'min';
          else if (/^MAX\s*\(/i.test(rawExpr)) type = 'max';
          aggExprs.push({ alias, rawExpr, type });
        }

        if (rows.length === 0) {
          const obj = {};
          for (const ae of aggExprs) {
            if (['count_star', 'count', 'sum', 'coalesce'].includes(ae.type)) obj[ae.alias] = 0;
            else obj[ae.alias] = null;
          }
          return { rows: [obj], lastInsertRowid: null };
        }

        // Accumulate aggregates across all rows
        const acc = {};
        for (const ae of aggExprs) {
          if (ae.type === 'count_star' || ae.type === 'count') acc[ae.alias] = { count: 0 };
          else if (ae.type === 'sum') acc[ae.alias] = { sum: 0 };
          else if (ae.type === 'min') acc[ae.alias] = { min: Infinity };
          else if (ae.type === 'max') acc[ae.alias] = { max: -Infinity };
          else acc[ae.alias] = null;
        }

        for (const row of rows) {
          for (const ae of aggExprs) {
            if (ae.type === 'count_star' || ae.type === 'count') acc[ae.alias].count++;
            else if (ae.type === 'sum') {
              const colName = ae.rawExpr.replace(/^SUM\s*\(\s*/i, '').replace(/\s*\)\s*$/, '').replace(/COALESCE\([^,]+,(\d+)\)/g, 'COALESCE');
              let val = parseFloat(row[colName]) || 0;
              // Handle COALESCE inline in SUM
              if (colName === 'COALESCE') {
                const innerM = ae.rawExpr.match(/COALESCE\s*\(\s*(.+?)\s*,\s*(\d+)\s*\)/i);
                if (innerM) val = parseFloat(row[innerM[1].trim()]) || parseFloat(innerM[2]);
              }
              acc[ae.alias].sum += val;
            } else if (ae.type === 'min') {
              const colName = ae.rawExpr.replace(/^MIN\s*\(\s*/i, '').replace(/\s*\)\s*$/, '');
              const val = parseFloat(row[colName]);
              if (val < acc[ae.alias].min) acc[ae.alias].min = val;
            } else if (ae.type === 'max') {
              const colName = ae.rawExpr.replace(/^MAX\s*\(\s*/i, '').replace(/\s*\)\s*$/, '');
              const val = parseFloat(row[colName]);
              if (val > acc[ae.alias].max) acc[ae.alias].max = val;
            } else if (ae.type === 'coalesce') {
              const m = ae.rawExpr.match(/COALESCE\s*\(\s*(.+?)\s*,\s*(\d+)\s*\)/i);
              if (m) {
                const val = row[m[1].trim()];
                acc[ae.alias] = (val !== null && val !== undefined && val !== '') ? parseFloat(val) : parseFloat(m[2]);
              }
            }
          }
        }

        const obj = {};
        for (const ae of aggExprs) {
          if (ae.type === 'count_star' || ae.type === 'count') obj[ae.alias] = acc[ae.alias].count;
          else if (ae.type === 'sum') obj[ae.alias] = acc[ae.alias].sum;
          else if (ae.type === 'min') obj[ae.alias] = acc[ae.alias].min === Infinity ? null : acc[ae.alias].min;
          else if (ae.type === 'max') obj[ae.alias] = acc[ae.alias].max === -Infinity ? null : acc[ae.alias].max;
          else if (ae.type === 'coalesce') obj[ae.alias] = acc[ae.alias] ?? 0;
          else obj[ae.alias] = null;
        }
        return { rows: [obj], lastInsertRowid: null };
      }

      // Non-aggregate column projection
      for (const row of rows) {
        if (parsed.columns === '*') {
          result.push(clone(row));
        } else {
          const obj = {};
          const cols = parsed.columns.split(',').map(c => c.trim());
          for (const c of cols) {
            const aliasMatch = c.match(/^(.+?)\s+AS\s+(\w+)$/i);
            if (aliasMatch) {
              let colName = aliasMatch[1].trim();
              if (colName === '*') {
                // t.* AS alias — copy all row keys
                Object.assign(obj, clone(row));
                continue;
              }
              if (colName.includes('.')) colName = colName.split('.').pop();
              obj[aliasMatch[2]] = evaluateAggregate(colName, row);
            } else {
              if (c === '*') {
                result.push(clone(row));
                continue;
              }
              const starPrefix = c.match(/^(\w+)\.\*$/);
              if (starPrefix) {
                // t.* — copy all row keys (already joined into one row)
                Object.assign(obj, clone(row));
                continue;
              }
              let colKey = c;
              if (colKey.includes('.')) colKey = colKey.split('.').pop();
              obj[colKey] = evaluateAggregate(colKey, row);
            }
          }
          result.push(clone(obj));
        }
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
      // ON CONFLICT DO NOTHING: skip if matching row exists
      if (parsed.conflictCol) {
        const existing = (tables[parsed.table] || []).find(r => r[parsed.conflictCol] === row[parsed.conflictCol]);
        if (existing) return { rows: [], lastInsertRowid: existing.id };
      }
      if (!row.id) row.id = ++lastId;
      tables[parsed.table].push(row);
      return { rows: [], lastInsertRowid: row.id };
    }

    case 'update': {
      let count = 0;
      let rows = tables[parsed.table] || [];
      const setParamCount = (parsed.sets.match(/\?/g) || []).length;
      const whereParams = params.slice(setParamCount);
      if (parsed.whereConditions) rows = rows.filter(r => evaluateRow(r, parsed.whereConditions, whereParams));
      for (const r of rows) {
        evalSets(r, parsed.sets, params.slice(0, setParamCount));
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
