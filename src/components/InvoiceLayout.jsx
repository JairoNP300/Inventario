import React from 'react';

// Unified Invoice Layout - Diseño Profesional de Factura
export default function InvoiceLayout({
  company = 'CARNES DEL PARAGUAY S.A.S DE C.V',
  address = 'CALLE LA MASCOTA, CONDOMINIO GALICIA, COLONIA SAN BENITO, 18. MUNICIPIO DE SAN SALVADOR CENTRO.',
  nit = '0623-160725-114-6',
  nrc = '367641-0',
  phone = '2222-2222',
  email = 'carnesdelparaguaysasdecv@gmail.com',
  recipient = {},
  date = new Date().toISOString(),
  items = [],
  totals = {},
  paymentCondition = 'CONTADO',
  observations = '',
  deliverer = '',
  receiver = '',
  onPrint,
  onSave,
  onCancel
}) {
  const { subtotal = 0, tax = 0, total = 0 } = totals || {};
  
  // Conversor simple de números a letras (español, versión simplificada)
  const numberToWords = (n) => {
    if (n < 0) return 'MENOS ' + numberToWords(-n);
    if (n === 0) return 'CERO';
    const unidades = ['', 'UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISEIS','DIECISIETE','DIECIOCHO','DIECINUEVE'];
    const decenas = ['', '', 'VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
    const centenas = ['', 'CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];
    const toWord = (num) => {
      if (num < 20) return unidades[num];
      if (num < 100) {
        const d = Math.floor(num / 10);
        const r = num % 10;
        if (r === 0) return decenas[d];
        return decenas[d] + ' Y ' + unidades[r];
      }
      if (num < 1000) {
        const c = Math.floor(num / 100);
        const r = num % 100;
        const head = c === 1 && r !== 0 ? 'CIENTO' : centenas[c];
        return r ? head + ' ' + toWord(r) : head;
      }
      if (num < 1000000) {
        const miles = Math.floor(num / 1000);
        const r = num % 1000;
        const milesWord = miles + ' MIL';
        return r ? milesWord + ' ' + toWord(r) : milesWord;
      }
      const millones = Math.floor(num / 1000000);
      const r = num % 1000000;
      const millonesWord = toWord(millones) + ' MILLON';
      return r ? millonesWord + ' ' + toWord(r) : millonesWord;
    };
    return toWord(Math.floor(n)).trim().toUpperCase();
  };

  const totalInt = Math.floor(total || 0);
  const cents = Math.round(((total || 0) - totalInt) * 100);
  const totalInWords = cents > 0 ? numberToWords(totalInt) + ' CON ' + numberToWords(cents) + ' CENTAVOS' : numberToWords(totalInt);
  
  // Generar código de factura aleatorio
  const codigoFactura = `DTE-03-M001P001-${Math.random().toString(36).toUpperCase().substring(2, 10)}`;
  
  return (
    <div className="invoice-container" style={{ 
      padding: 24,
      fontFamily: 'Arial, sans-serif',
      color: '#111827',
      background: '#ffffff',
      maxWidth: 840,
      margin: '0 auto',
      borderRadius: 6,
      boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
      border: '1px solid #d1d5db'
    }}>
      {/* Badge de documento */}
      <div className="header-badge" style={{
        background: '#111827',
        color: '#ffffff',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 1,
        padding: '6px 12px',
        borderRadius: 2,
        display: 'inline-block',
        marginBottom: 14
      }}>
        DOCUMENTO TRIBUTARIO ELECTRÓNICO
      </div>
      
      {/* Encabezado de la empresa */}
      <div style={{ marginBottom: 16, borderBottom: '1px solid #d1d5db', paddingBottom: 12 }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#111827', margin: 0, letterSpacing: -0.5 }}>
          {company}
        </h1>
        <p style={{ color: '#374151', margin: '5px 0 0 0', fontSize: '0.85rem' }}>
          {address}
        </p>
        <p style={{ color: '#374151', margin: '4px 0 0 0', fontSize: '0.82rem' }}>
          <strong>TELÉFONO:</strong> {phone} | <strong>CORREO:</strong> {email}
        </p>
        <p style={{ marginTop: 8, fontSize: '0.82rem' }}>
          <strong>NIT:</strong> {nit} | <strong>NRC:</strong> {nrc}
        </p>
      </div>
      
      {/* Información del documento */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, padding: 10, background: '#f3f4f6', border: '1px solid #d1d5db' }}>
        <div>
          <div style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', fontWeight: 700 }}>Tipo de Documento</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>COMPROBANTE DE CRÉDITO FISCAL</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', fontWeight: 700 }}>Código de Generación</div>
          <div style={{ fontSize: 11, color: '#1f2937', fontFamily: 'monospace' }}>{codigoFactura}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', fontWeight: 700 }}>Fecha de Emisión</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>
            {new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>
      
      {/* Datos del receptor */}
      <div style={{ marginBottom: 14, padding: 10, background: '#ffffff', border: '1px solid #d1d5db' }}>
        <div style={{ fontSize: 10, color: '#ffffff', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8, background: '#111827', padding: '4px 8px' }}>
          DATOS DEL RECEPTOR
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
          <div><strong>Nombre/Razón Social:</strong> {recipient.name || '---'}</div>
          <div><strong>NIT/DUI:</strong> {recipient.nit || '---'}</div>
          <div><strong>NRC:</strong> {recipient.nrc || '---'}</div>
          <div><strong>Dirección:</strong> {recipient.address || '---'}</div>
        </div>
      </div>
      
      {/* Tabla de items */}
      <div style={{ marginBottom: 14, overflow: 'hidden', border: '1px solid #d1d5db' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#111827' }}>
              <th style={{ textAlign: 'left', padding: '8px 10px', color: 'white', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>N°</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', color: 'white', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Cantidad</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', color: 'white', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Unidad</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', color: 'white', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Descripción</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', color: 'white', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>P. Unitario</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', color: 'white', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Ventas Gravadas</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 12, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>No hay productos registrados en el detalle</td></tr>
            )}
            {items.map((it, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '8px 10px', fontSize: 12 }}>{idx + 1}</td>
                <td style={{ padding: '8px 10px', fontSize: 12 }}>{Number(it.qty || 0).toFixed(2)}</td>
                <td style={{ padding: '8px 10px', fontSize: 12 }}>{it.unit || 'Und'}</td>
                <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600 }}>{it.description || 'Producto'}</td>
                <td style={{ padding: '8px 10px', fontSize: 12, textAlign: 'right' }}>${Number(it.unitPrice || it.price || 0).toFixed(2)}</td>
                <td style={{ padding: '8px 10px', fontSize: 12, textAlign: 'right', fontWeight: 700 }}>${Number(it.total || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Totales */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <div style={{ width: 320, padding: 12, background: '#ffffff', border: '1px solid #d1d5db' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
            <span style={{ color: '#64748b' }}>Sumatoria Ventas Gravadas</span>
            <span style={{ fontWeight: 700 }}>${subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
            <span style={{ color: '#64748b' }}>13% IVA</span>
            <span style={{ fontWeight: 700 }}>${tax.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #e2e8f0', fontSize: 16, fontWeight: 900 }}>
            <span>MONTO TOTAL A PAGAR</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 14, border: '1px solid #d1d5db' }}>
        <div style={{ background: '#111827', color: '#fff', fontSize: 10, fontWeight: 700, padding: '4px 8px' }}>EXTENSIÓN</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: 10, fontSize: 12 }}>
          <div><strong>Condición de la operación:</strong> {paymentCondition || recipient.paymentCondition || 'CONTADO'}</div>
          <div><strong>Observaciones:</strong> {observations || recipient.observations || '---'}</div>
          <div><strong>Nombre Entrega:</strong> {deliverer || recipient.deliverer || '---'}</div>
          <div><strong>Nombre Recibe:</strong> {receiver || recipient.receiver || '---'}</div>
        </div>
      </div>
      
      {/* Notas */}
      <div style={{ marginBottom: 30, padding: 15, background: '#fefce8', borderRadius: 8, border: '1px solid #fef08a' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#a16207', marginBottom: 5 }}>SON:</div>
        <div style={{ fontSize: 14, color: '#713f12' }}>{totalInWords} DÓLARES</div>
        <div style={{ fontSize: 11, color: '#a16207', marginTop: 8 }}>Esta factura no incluye retenciones adicionales sujetas al comprador salvo que se especifique. Operación sujeta a revisión.</div>
      </div>
      
      {/* Botones de acción */}
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button 
          onClick={onSave || onPrint} 
          className="btn-primary" 
          style={{ 
            flex: 1, 
            background: '#10b981', 
            color: 'white',
            padding: '14px 24px',
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 14,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          Guardar Venta & Imprimir
        </button>
        <button 
          onClick={onCancel || (() => window.print())} 
          style={{ 
            flex: 1, 
            background: '#ef4444', 
            color: 'white',
            padding: '14px 24px',
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 14,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          Cancelar Operación
        </button>
      </div>
      <div style={{ textAlign: 'right', fontFamily: 'monospace', marginTop: 6 }}>
        <strong>Total en Letras:</strong> {totalInWords} DÓLARES
      </div>
    </div>
  );
}
