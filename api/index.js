import serverless from 'serverless-http';
import app, { initDb, migrateDatabase } from '../server/server.js';
import * as db from '../server/github-db.js';

let initialized = false;
let handler;

export default async (req, res) => {
  if (!initialized) {
    try {
      await db.init();
      await initDb();
      await migrateDatabase();
      handler = serverless(app);
      initialized = true;
    } catch (e) {
      console.error('[API] Init error:', e.message);
      res.status(500).json({ error: 'Init failed: ' + e.message });
      return;
    }
  }
  return handler(req, res);
};
