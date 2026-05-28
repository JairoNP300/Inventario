export default (req, res) => {
  res.json({
    vercel: !!process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV || '',
    hasDbUrl: !!process.env.DATABASE_URL,
    nodeVersion: process.version,
    cwd: process.cwd()
  });
};
