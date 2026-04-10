const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/database.db');

db.serialize(() => {
  db.run("UPDATE inventory SET bodega_1 = 100, bodega_2 = 100, bodega_3 = 100, bodega_4 = 100", (err) => {
    if (err) {
      console.error("Error al actualizar stock:", err.message);
    } else {
      console.log("✅ ÉXITO: Todos los productos ahora tienen 100 de stock en todas las bodegas.");
    }
  });
});

db.close();
