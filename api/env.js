export default (req, res) => {
  res.json({
    DATABASE_URL: process.env.DATABASE_URL ? process.env.DATABASE_URL.slice(0, 40) + '...' : 'NOT SET',
    VERCEL: process.env.VERCEL,
    NODE_ENV: process.env.NODE_ENV,
    keys: Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('VERCEL') || k.includes('NODE'))
  });
};
