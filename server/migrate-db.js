// Database migration script for production deployment
import Database from 'better-sqlite3';
import pkg from 'pg';
const { Pool } = pkg;

const isProduction = !!process.env.DATABASE_URL;

async function migrateDatabase() {
  console.log('Starting database migration...');
  
  if (isProduction) {
    // PostgreSQL migration
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    try {
      // 1. Update agros table with new locations
      console.log('Updating agros table...');
      await pool.query('DELETE FROM agros');
      
      const agros = [
        [1, 'Ransa'],
        [2, 'Soyapango'],
        [3, 'Usulután'],
        [4, 'Lomas de San Francisco']
      ];
      
      for (const [id, name] of agros) {
        await pool.query('INSERT INTO agros (id, name) VALUES ($1, $2)', [id, name]);
      }

      // 2. Update inventory with 100 units per bodega
      console.log('Updating inventory stock levels...');
      const products = await pool.query('SELECT id FROM products');
      
      for (const product of products.rows) {
        await pool.query(`
          INSERT INTO inventory (product_id, bodega_1, bodega_2, bodega_3, bodega_4, initial_stock, current_stock, sold_stock)
          VALUES ($1, 100, 100, 100, 100, 400, 400, 0)
          ON CONFLICT (product_id) DO UPDATE SET
            bodega_1 = 100,
            bodega_2 = 100,
            bodega_3 = 100,
            bodega_4 = 100,
            initial_stock = 400,
            current_stock = 400,
            sold_stock = 0
        `, [product.id]);
      }

      console.log('PostgreSQL migration completed successfully');
    } catch (error) {
      console.error('PostgreSQL migration error:', error);
      throw error;
    } finally {
      await pool.end();
    }
  } else {
    // SQLite migration
    const db = new Database('inventario_oficial.db');
    
    try {
      // 1. Update agros table
      console.log('Updating agros table...');
      db.prepare('DELETE FROM agros').run();
      
      const agros = [
        [1, 'Ransa'],
        [2, 'Soyapango'],
        [3, 'Usulután'],
        [4, 'Lomas de San Francisco']
      ];
      
      const insertAgro = db.prepare('INSERT INTO agros (id, name) VALUES (?, ?)');
      agros.forEach(([id, name]) => insertAgro.run(id, name));

      // 2. Update inventory
      console.log('Updating inventory stock levels...');
      const products = db.prepare('SELECT id FROM products').all();
      
      const updateInventory = db.prepare(`
        UPDATE inventory 
        SET bodega_1 = 100, 
            bodega_2 = 100, 
            bodega_3 = 100, 
            bodega_4 = 100,
            initial_stock = 400,
            current_stock = 400,
            sold_stock = 0
        WHERE product_id = ?
      `);
      
      products.forEach(product => updateInventory.run(product.id));

      console.log('SQLite migration completed successfully');
    } catch (error) {
      console.error('SQLite migration error:', error);
      throw error;
    } finally {
      db.close();
    }
  }
}

// Run migration
migrateDatabase().catch(console.error);
