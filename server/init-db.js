import Database from 'better-sqlite3';
import pkg from 'pg';
const { Pool } = pkg;

// Database initialization for production
const isProduction = !!process.env.DATABASE_URL;

async function initializeDatabase() {
  if (isProduction) {
    console.log('Initializing PostgreSQL database...');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        code TEXT,
        name TEXT NOT NULL UNIQUE,
        category TEXT,
        price_per_lb DECIMAL(10,2) DEFAULT 0,
        price_per_kg DECIMAL(10,2) DEFAULT 0,
        price_per_box DECIMAL(10,2) DEFAULT 0
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS agros (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        product_id INTEGER PRIMARY KEY,
        bodega_1 DECIMAL(10,2) DEFAULT 0,
        bodega_2 DECIMAL(10,2) DEFAULT 0,
        bodega_3 DECIMAL(10,2) DEFAULT 0,
        bodega_4 DECIMAL(10,2) DEFAULT 0,
        initial_stock DECIMAL(10,2) DEFAULT 0,
        sold_stock DECIMAL(10,2) DEFAULT 0,
        current_stock DECIMAL(10,2) DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `);

    // Insert new location options
    await pool.query('DELETE FROM agros');
    const agros = [
      [1, 'Ransa'],
      [2, 'Soyapango'],
      [3, 'Usulután'],
      [4, 'Lomas de San Francisco']
    ];
    
    for (const [id, name] of agros) {
      await pool.query('INSERT INTO agros (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [id, name]);
    }

    console.log('PostgreSQL database initialized successfully');
    await pool.end();
  } else {
    console.log('Initializing SQLite database...');
    const Database = (await import('better-sqlite3')).default;
    const db = new Database('inventario_oficial.db');
    
    // SQLite initialization (existing code)
    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT,
        name TEXT NOT NULL UNIQUE,
        category TEXT,
        price_per_lb DECIMAL(10,2) DEFAULT 0,
        price_per_kg DECIMAL(10,2) DEFAULT 0,
        price_per_box DECIMAL(10,2) DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS agros (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS inventory (
        product_id INTEGER PRIMARY KEY,
        bodega_1 DECIMAL(10,2) DEFAULT 0,
        bodega_2 DECIMAL(10,2) DEFAULT 0,
        bodega_3 DECIMAL(10,2) DEFAULT 0,
        bodega_4 DECIMAL(10,2) DEFAULT 0,
        initial_stock DECIMAL(10,2) DEFAULT 0,
        sold_stock DECIMAL(10,2) DEFAULT 0
      );
    `);

    console.log('SQLite database initialized successfully');
    db.close();
  }
}

// Run initialization
initializeDatabase().catch(console.error);
