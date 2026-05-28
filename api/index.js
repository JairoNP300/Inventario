import serverless from 'serverless-http';
import app, { initDb, migrateDatabase } from '../server/server.js';

let ready = false;
let handler;

export default async (req, res) => {
  if (!ready) {
    await initDb();
    await migrateDatabase();
    ready = true;
    handler = serverless(app);
  }
  return handler(req, res);
};
