export default async (req, res) => {
  try {
    const pg = await import('pg');
    res.json({ ok: true, hasPool: typeof pg.Pool, defaultType: typeof pg.default });
  } catch (e) {
    res.json({ error: e.message, stack: e.stack?.split('\n')[0] });
  }
};
