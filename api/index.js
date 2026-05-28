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
      res.status(500).json({ error: 'Init failed: ' + e.message });
      return;
    }
    ready = true;
    handler = serverless(app);
  }
  return handler(req, res);
};
