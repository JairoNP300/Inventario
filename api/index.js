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
      try {
        const { rows: testQuery } = await (await import('../server/server.js')).pool.query('SELECT 1');
        console.log('Pool works:', testQuery);
      } catch(e2) {
        console.error('Pool also fails:', e2.message);
      }
      res.status(500).json({ error: 'Init failed: ' + e.message, stack: e.stack?.split('\n').slice(0,5).join('; ') });
      return;
    }
    ready = true;
    handler = serverless(app);
  }
  return handler(req, res);
};
