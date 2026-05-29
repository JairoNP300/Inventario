import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Datos extraídos de la imagen "CONTROL DE CAJAS - ENTRADAS, SALIDAS Y STOCK ACTUAL"
// Generado: 25 de mayo de 2026 a las 10:59 a. m.
const imageData = {
  'Posta Negra / Nalga de Adentro': {
    code: '1618',
    entradas_cajas: 326,
    salidas_cajas: 103,
    stock_cajas: 223
  },
  'Cajas Tortuguita': {
    code: '1619',
    entradas_cajas: 200,
    salidas_cajas: 41,
    stock_cajas: 159
  },
  'HUESO DE YUGO / COGOTE CON HUESO': {
    code: '1620',
    entradas_cajas: 114,
    salidas_cajas: 105,
    stock_cajas: 9
  },
  'NEW YORK / BIEF ANGOSTO': {
    code: '1621',
    entradas_cajas: 45,
    salidas_cajas: 32,
    stock_cajas: 13
  },
  'TRIMING 80/20 especial': {
    code: '1622',
    entradas_cajas: 43,
    salidas_cajas: 20,
    stock_cajas: 23
  },
  'cajas de triming 50/50 popular': {
    code: '1623',
    entradas_cajas: 45,
    salidas_cajas: 34,
    stock_cajas: 11
  },
  'cajas de Aguja/chuck': {
    code: '1624',
    entradas_cajas: 105,
    salidas_cajas: 1,
    stock_cajas: 104
  },
  'ANGELINA / CORAZON DE CUADRIL': {
    code: '1625',
    entradas_cajas: 55,
    salidas_cajas: 55,
    stock_cajas: 0
  },
  'CARNE BOVINA CONGELADA SIN HUESO DELANTERO': {
    code: '1626',
    entradas_cajas: 46,
    salidas_cajas: 2,
    stock_cajas: 44
  },
  'CARNE BOVINA CONGELADA SIN HUESO TAPA CUADRIL': {
    code: '1627',
    entradas_cajas: 53,
    salidas_cajas: 21,
    stock_cajas: 32
  },
  'CARNE BOVINA CONGELADA SIN HUESO RECORTE DE CARNE 90 VL premium': {
    code: '1628',
    entradas_cajas: 186,
    salidas_cajas: 33,
    stock_cajas: 153
  }
};

async function integrateImageData() {
  try {
    const dataPath = join(__dirname, 'data', 'data.json');
    const rawData = await readFile(dataPath, 'utf-8');
    const data = JSON.parse(rawData);

    console.log('📊 Integrando datos de la imagen de control de cajas...');
    console.log(`📅 Fecha: 25 de mayo de 2026 a las 10:59 a. m.\n`);

    // Crear mapa de productos por código para búsqueda rápida
    const productsByCode = {};
    for (const p of data.products) {
      productsByCode[p.code] = p;
    }

    // Actualizar inventario con los datos de la imagen
    let updated = 0;
    for (const inv of data.inventory) {
      const product = data.products.find(p => p.id === inv.product_id);
      if (!product) continue;

      const imageValues = imageData[product.name];
      if (imageValues) {
        const oldEntradas = inv.entradas_cajas;
        const oldSalidas = inv.salidas_cajas;

        inv.entradas_cajas = imageValues.entradas_cajas;
        inv.salidas_cajas = imageValues.salidas_cajas;
        inv.cajas = imageValues.stock_cajas;

        console.log(`✅ ${product.code} - ${product.name}`);
        console.log(`   Entradas: ${oldEntradas} → ${imageValues.entradas_cajas}`);
        console.log(`   Salidas: ${oldSalidas} → ${imageValues.salidas_cajas}`);
        console.log(`   Stock: ${imageValues.stock_cajas}\n`);

        updated++;
      }
    }

    // Guardar datos actualizados
    await writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`\n✨ Integración completada: ${updated} productos actualizados`);
    console.log(`📁 Archivo guardado: ${dataPath}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

integrateImageData();
