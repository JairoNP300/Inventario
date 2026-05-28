export default (req, res) => {
  res.json({ ok: true, vercel: !!process.env.VERCEL });
};
