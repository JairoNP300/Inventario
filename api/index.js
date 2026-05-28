import serverless from 'serverless-http';
import app, { initDb, migrateDatabase } from '../server/server.js';

let ready = false;
let handler;

export default async (req, res) => {
  if (!ready) {
    try {
      await initDb();
      await migrateDatabase();
    } catch (e) {
      // Try direct connection to show real error
      let dbError = null;
      try {
        const { Pool } = await import('pg');
        const p = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 10000
        });
        await p.query('SELECT 1');
        await p.end();
        dbError = null;
      } catch (e2) {
        dbError = e2.message;
      }
      res.status(500).json({
        error: 'Init failed: ' + e.message,
        stack: e.stack?.split('\n').slice(0,5).join('; '),
        dbUrl: (process.env.DATABASE_URL || 'NOT SET').slice(0, 50) + '...',
        dbTest: dbError || 'Pool connects OK but initDb failed'
      });
      return;
    }
    ready = true;
    handler = serverless(app);
  }
  return handler(req, res);
};
