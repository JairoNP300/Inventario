import serverless from 'serverless-http';
import app, { initDb, migrateDatabase } from '../server/server.js';

let ready = false;
let handler;

export default async (req, res) => {
  // Special debug endpoint
  if (req.url === '/api/env') {
    try {
      const { Pool } = await import('pg');
      const testPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000
      });
      const r = await testPool.query('SELECT 1 as connected');
      await testPool.end();
      return res.json({ DATABASE_URL: (process.env.DATABASE_URL || '').slice(0,40) + '...', connected: true, result: r.rows[0] });
    } catch (e) {
      return res.json({ DATABASE_URL: (process.env.DATABASE_URL || '').slice(0,40) + '...', connected: false, error: e.message, code: e.code });
    }
  }

  if (!ready) {
    try {
      await initDb();
      await migrateDatabase();
    } catch (e) {
      res.status(500).json({ error: 'Init failed: ' + e.message, stack: e.stack?.split('\n').slice(0,5).join('; ') });
      return;
    }
    ready = true;
    handler = serverless(app);
  }
  return handler(req, res);
};
