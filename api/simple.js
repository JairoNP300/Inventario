import serverless from 'serverless-http';
import express from 'express';
const app = express();
app.get('*', (req, res) => res.json({ ok: true, url: req.url, method: req.method }));
export default serverless(app);
