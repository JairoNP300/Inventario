import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('./server/database.db');

db.serialize(() => {
  db.run("UPDATE inventory SET bodega_1 = 100, bodega_2 = 100, bodega_3 = 100, bodega_4 = 100", (err) => {
    if (err) {
      console.error("Error al actualizar stock:", err.message);
    } else {
      console.log("✅ ÉXITO: Todo el Balance Consolidado se ha actualizado a 100 unidades por bodega.");
    }
  });
});

db.close();
