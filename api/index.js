import serverless from 'serverless-http';
import app, { initDb, migrateDatabase } from '../server/server.js';
import * as db from '../server/github-db.js';

let initialized = false;
let handler;

export default async (req, res) => {
  try {
    if (!initialized) {
      await db.init();
      await initDb();
      await migrateDatabase();
      handler = serverless(app);
      initialized = true;
    }
    return handler(req, res);
  } catch (e) {
    console.error('[API] Init error:', e.message, e.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Init failed: ' + e.message });
    }
  }
};
