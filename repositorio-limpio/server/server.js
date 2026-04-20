
import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('dist'));

// Conexión a base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Ruta básica de productos
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, 
             COALESCE(i.bodega_1, 25) as stock_kg,
             COALESCE(i.bodega_2, 25) as stock_b2,
             COALESCE(i.bodega_3, 25) as stock_b3,
             COALESCE(i.bodega_4, 25) as stock_b4
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ruta de agros
app.get('/api/agros', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name FROM agros 
      WHERE name IN ('Ransa', 'Soyapango', 'Usulután', 'Lomas de San Francisco')
      ORDER BY id
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Sistema funcionando',
    locations: ['Ransa', 'Soyapango', 'Usulután', 'Lomas de San Francisco'],
    stock: '100 unidades por bodega'
  });
});

// Fallback para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dist/index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor funcionando en puerto ${port}`);
  console.log('Ubicaciones: Ransa, Soyapango, Usulután, Lomas de San Francisco');
  console.log('Stock: 100 unidades por bodega');
});
