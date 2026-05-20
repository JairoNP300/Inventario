import React from 'react';

export default function InvoiceLayout({
  company = 'CARNES DEL PARAGUAY S.A.S DE C.V',
  address = 'CALLE LA MASCOTA, CONDOMINIO GALICIA, COLONIA SAN BENITO, 18',
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
  const { subtotal = 0, discount = 0, total = 0 } = totals || {};

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

  const codigoFactura = `DTE-03-M001P001-${Math.random().toString(36).toUpperCase().substring(2, 10)}`;

  return (
    <>
      <style>{`
        #invoice-preview-section {
          display: block;
          background: #ffffff !important;
          border-radius: 8px;
          padding: 1px;
        }
        #invoice-print-area {
          background: #ffffff !important;
          color: #111827 !important;
          font-family: Arial, Helvetica, sans-serif !important;
          font-size: 10px !important;
          line-height: 1.25 !important;
          padding: 14px 18px !important;
          max-width: 800px !important;
          margin: 0 auto !important;
        }
        #invoice-print-area .header-badge {
          background: #f3f4f6 !important;
          color: #4b5563 !important;
          font-size: 7px !important;
          font-weight: 700 !important;
          letter-spacing: 0.5px !important;
          padding: 3px 8px !important;
          display: inline-block !important;
          margin-bottom: 8px !important;
        }
        #invoice-print-area h1 {
          font-size: 1.2rem !important;
          font-weight: 900 !important;
          color: #111827 !important;
          margin: 0 0 4px 0 !important;
          letter-spacing: -0.5px !important;
        }
        #invoice-print-area p {
          margin: 3px 0 !important;
          font-size: 0.7rem !important;
          color: #374151 !important;
        }
        #invoice-print-area table {
          width: 100% !important;
          border-collapse: collapse !important;
          table-layout: fixed !important;
          margin: 0 !important;
          background: transparent !important;
        }
        #invoice-print-area th,
        #invoice-print-area td {
          padding: 4px 6px !important;
          font-size: 9px !important;
          color: #111827 !important;
          background: transparent !important;
          border: 0 !important;
          border-bottom: 1px solid #e5e7eb !important;
          word-break: break-word !important;
          font-weight: 400 !important;
          text-align: left !important;
          vertical-align: middle !important;
          line-height: 1.2 !important;
        }
        #invoice-print-area thead th {
          background: #1f2937 !important;
          color: #ffffff !important;
          font-weight: 800 !important;
          font-size: 7px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          padding: 5px 6px !important;
          border-bottom: 0 !important;
        }
        #invoice-print-area tbody tr:last-child td {
          border-bottom: 0 !important;
        }
        .il-totals-box {
          background: #ffffff !important;
          border: 1px solid #e5e7eb !important;
          padding: 6px 10px !important;
          width: 260px !important;
          margin-left: auto !important;
          margin-bottom: 8px !important;
        }
        .il-totals-box .il-row {
          display: flex !important;
          justify-content: space-between !important;
          font-size: 9px !important;
          margin-bottom: 3px !important;
          color: #111827 !important;
        }
        .il-totals-box .il-total-row {
          display: flex !important;
          justify-content: space-between !important;
          border-top: 2px solid #1f2937 !important;
          padding-top: 4px !important;
          font-size: 11px !important;
          font-weight: 900 !important;
          color: #111827 !important;
        }
        .il-son-box {
          padding: 7px 10px !important;
          background: #fefce8 !important;
          border: 1px solid #fef08a !important;
          border-radius: 5px !important;
          margin-bottom: 12px !important;
        }
        .il-son-box .il-son-label {
          font-size: 8px !important;
          font-weight: 700 !important;
          color: #a16207 !important;
          margin-bottom: 2px !important;
        }
        .il-son-box .il-son-words {
          font-size: 9px !important;
          color: #713f12 !important;
          font-weight: 600 !important;
        }
        .il-son-box .il-disclaimer {
          font-size: 7px !important;
          color: #a16207 !important;
          margin-top: 4px !important;
        }
        .il-section-header {
          font-size: 7px !important;
          color: #ffffff !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          padding: 2px 7px !important;
          background: #1f2937 !important;
          margin-bottom: 0 !important;
        }
        .il-meta {
          display: flex !important;
          justify-content: space-between !important;
          margin-bottom: 8px !important;
          padding: 5px 7px !important;
          background: #f9fafb !important;
          border: 1px solid #e5e7eb !important;
        }
        .il-meta > div {
          font-size: 7px !important;
          color: #6b7280 !important;
        }
        .il-meta .il-label {
          font-size: 7px !important;
          color: #6b7280 !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
        }
        .il-meta .il-value {
          font-size: 9px !important;
          font-weight: 800 !important;
          color: #111827 !important;
        }
        .il-recipient-grid {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 2px !important;
          font-size: 9px !important;
          padding: 6px 8px !important;
          color: #111827 !important;
        }
        .il-extension-grid {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 2px !important;
          padding: 5px 7px !important;
          font-size: 9px !important;
          color: #111827 !important;
        }
        #invoice-print-area .il-no-print {
          display: flex !important;
          gap: 10px !important;
          margin-top: 12px !important;
        }
        #invoice-print-area .il-no-print button {
          flex: 1 !important;
          padding: 9px 16px !important;
          border-radius: 7px !important;
          font-weight: 700 !important;
          font-size: 10px !important;
          border: none !important;
          cursor: pointer !important;
          color: white !important;
        }
        .il-btn-save { background: #10b981 !important; }
        .il-btn-cancel { background: #64748b !important; }
        @media print {
          body, html {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          body * {
            visibility: hidden !important;
          }
          #invoice-print-area, #invoice-print-area * {
            visibility: visible !important;
          }
          #invoice-print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 8px 14px !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            font-size: 9px !important;
          }
          .il-no-print { display: none !important; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>
      <div id="invoice-print-area">
        <div className="header-badge">DOCUMENTO TRIBUTARIO ELECTRÓNICO</div>

        <div style={{ marginBottom: 8, borderBottom: '1px solid #d1d5db', paddingBottom: 6 }}>
          <h1>{company}</h1>
          <p>{address}</p>
          <p><strong>TELÉFONO:</strong> {phone} | <strong>CORREO:</strong> {email}</p>
          <p style={{ marginTop: 3 }}><strong>NIT:</strong> {nit} | <strong>NRC:</strong> {nrc}</p>
        </div>

        <div className="il-meta">
          <div>
            <div className="il-label">Tipo de Documento</div>
            <div className="il-value">COMPROBANTE DE CRÉDITO FISCAL</div>
          </div>
          <div>
            <div className="il-label">Código de Generación</div>
            <div style={{ fontSize: '8px', color: '#1f2937', fontFamily: 'monospace' }}>{codigoFactura}</div>
          </div>
          <div>
            <div className="il-label">Fecha de Emisión</div>
            <div className="il-value">
              {new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 6, border: '1px solid #e5e7eb' }}>
          <div className="il-section-header">DATOS DEL RECEPTOR</div>
          <div className="il-recipient-grid">
            <div><strong>Nombre/Razón Social:</strong> {recipient.name || '---'}</div>
            <div><strong>NIT/DUI:</strong> {recipient.nit || '---'}</div>
            <div><strong>NRC:</strong> {recipient.nrc || '---'}</div>
            <div><strong>Dirección:</strong> {recipient.address || '---'}</div>
          </div>
        </div>

        <div style={{ marginBottom: 6, border: '1px solid #e5e7eb' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '5%', textAlign: 'center' }}>N°</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Cantidad</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Unidad</th>
                <th style={{ width: '38%' }}>Descripción</th>
                <th style={{ width: '17%', textAlign: 'right' }}>P. Unitario</th>
                <th style={{ width: '20%', textAlign: 'right' }}>Ventas Gravadas</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '10px', color: '#6b7280' }}>No hay productos registrados en el detalle</td></tr>
              )}
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: 'center', fontWeight: 500 }}>{idx + 1}</td>
                  <td style={{ textAlign: 'center' }}>{Number(it.qty || 0).toFixed(2)}</td>
                  <td style={{ textAlign: 'center' }}>{it.unit || 'Und'}</td>
                   <td style={{ fontWeight: 600 }}>{it.description || it.name || 'Producto'}</td>
                  <td style={{ textAlign: 'right' }}>${Number(it.unitPrice || it.price || 0).toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>${Number(it.total || it.subtotal || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="il-totals-box">
          <div className="il-row">
            <span>Sumatoria Ventas Gravadas</span>
            <span style={{ fontWeight: 700 }}>${subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="il-row">
              <span style={{ color: '#f59e0b' }}>Descuento ({discount}%)</span>
              <span style={{ fontWeight: 700, color: '#f59e0b' }}>${(subtotal * discount / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="il-total-row">
            <span>MONTO TOTAL A PAGAR</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        <div style={{ marginBottom: 6, border: '1px solid #e5e7eb' }}>
          <div className="il-section-header">EXTENSIÓN</div>
          <div className="il-extension-grid">
            <div><strong>Condición:</strong> {paymentCondition || recipient.paymentCondition || 'CONTADO'}</div>
            <div><strong>Observaciones:</strong> {observations || recipient.observations || '---'}</div>
            <div><strong>Nombre Entrega:</strong> {deliverer || recipient.deliverer || '---'}</div>
            <div><strong>Nombre Recibe:</strong> {receiver || recipient.receiver || '---'}</div>
          </div>
        </div>

        <div className="il-son-box">
          <div className="il-son-label">SON:</div>
          <div className="il-son-words">{totalInWords} DÓLARES</div>
          <div className="il-disclaimer">Esta factura no incluye retenciones adicionales sujetas al comprador salvo que se especifique. Operación sujeta a revisión.</div>
        </div>

        <div className="il-no-print">
          <button className="il-btn-save" onClick={onSave || onPrint}>GUARDAR VENTA &amp; IMPRIMIR</button>
          <button className="il-btn-cancel" onClick={onCancel}>Volver al Formulario</button>
        </div>
      </div>
    </>
  );
}
