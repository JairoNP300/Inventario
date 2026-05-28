import serverless from 'serverless-http';
import app, { initDb, migrateDatabase } from '../server/server.js';

let ready = false;
let handler;

export default async (req, res) => {
  if (!ready) {
    try {
      await initDb();
      console.log('✅ initDb completado');
      await migrateDatabase();
      console.log('✅ migrateDatabase completado');
      ready = true;
      handler = serverless(app);
    } catch (e) {
      console.error('❌ Error en init:', e.message, e.stack);
      res.status(500).json({ error: 'Init failed: ' + e.message });
      return;
    }
  }
  return handler(req, res);
};
