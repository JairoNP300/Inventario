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
        #invoice-print-area {
          all: initial;
          display: block;
          padding: 14px 18px;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10px;
          line-height: 1.25;
          background: #ffffff !important;
          max-width: 800px;
          margin: 0 auto;
          color: #111827 !important;
        }
        #invoice-print-area * {
          all: revert;
          font-family: Arial, Helvetica, sans-serif;
        }
        #invoice-print-area .header-badge {
          background: #f3f4f6;
          color: #4b5563;
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 0.5px;
          padding: 3px 8px;
          display: inline-block;
          margin-bottom: 8px;
        }
        #invoice-print-area h1 {
          font-size: 1.2rem;
          font-weight: 900;
          color: #111827;
          margin: 0;
          letter-spacing: -0.5px;
        }
        #invoice-print-area p {
          margin: 3px 0;
          font-size: 0.7rem;
          color: #374151;
        }
        #invoice-print-area table {
          width: 100% !important;
          border-collapse: collapse !important;
          table-layout: fixed;
        }
        #invoice-print-area th,
        #invoice-print-area td {
          padding: 5px 7px !important;
          font-size: 9.5px !important;
          color: #111827 !important;
          background: transparent !important;
          border: none !important;
          word-break: break-word;
        }
        #invoice-print-area thead th {
          background: #1f2937 !important;
          color: #ffffff !important;
          font-weight: 800 !important;
          font-size: 7.5px !important;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border: none !important;
        }
        #invoice-print-area tbody tr {
          border-bottom: 1px solid #e5e7eb;
        }
        #invoice-print-area .totals-box {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          padding: 8px 12px;
          width: 260px;
          margin-left: auto;
        }
        #invoice-print-area .totals-box div {
          display: flex;
          justify-content: space-between;
          font-size: 9.5px;
          margin-bottom: 4px;
        }
        #invoice-print-area .totals-box .total-row {
          border-top: 2px solid #1f2937;
          padding-top: 5px;
          font-size: 11px;
          font-weight: 900;
        }
        #invoice-print-area .son-box {
          padding: 8px 12px;
          background: #fefce8;
          border: 1px solid #fef08a;
          border-radius: 6px;
          margin-bottom: 14px;
        }
        #invoice-print-area .son-box div:first-child {
          font-size: 8px;
          font-weight: 700;
          color: #a16207;
          margin-bottom: 3px;
        }
        #invoice-print-area .son-box .words {
          font-size: 10px;
          color: #713f12;
          font-weight: 600;
        }
        #invoice-print-area .son-box .disclaimer {
          font-size: 8px;
          color: #a16207;
          margin-top: 5px;
        }
        #invoice-print-area .section-header {
          font-size: 7px;
          color: #ffffff;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 3px 8px;
          background: #1f2937;
          margin-bottom: 5px;
        }
        #invoice-print-area .doc-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 6px 8px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
        }
        #invoice-print-area .doc-meta > div {
          font-size: 7px;
        }
        #invoice-print-area .doc-meta .label {
          font-size: 7px;
          color: #6b7280;
          font-weight: 700;
          text-transform: uppercase;
        }
        #invoice-print-area .doc-meta .value {
          font-size: 9px;
          font-weight: 800;
          color: #111827;
        }
        #invoice-print-area .recipient-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3px;
          font-size: 9px;
          padding: 8px;
        }
        #invoice-print-area .extension-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3px;
          padding: 6px 8px;
          font-size: 9px;
        }
        #invoice-print-area .no-print-buttons {
          display: flex;
          gap: 10px;
          margin-top: 14px;
        }
        #invoice-print-area .no-print-buttons button {
          flex: 1;
          padding: 10px 18px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 11px;
          border: none;
          cursor: pointer;
          letter-spacing: 0.5px;
          color: white;
        }
        #invoice-print-area .btn-save {
          background: #10b981;
        }
        #invoice-print-area .btn-cancel {
          background: #64748b;
        }
        @media print {
          body * { visibility: hidden !important; }
          #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
          #invoice-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 16px 20px !important;
            margin: 0 !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
          }
          #invoice-print-area .no-print-buttons { display: none !important; }
          @page { size: A4 portrait; margin: 4mm; }
        }
      `}</style>
      <div id="invoice-print-area">
        <div className="header-badge">DOCUMENTO TRIBUTARIO ELECTRÓNICO</div>

        <div style={{ marginBottom: 10, borderBottom: '1px solid #d1d5db', paddingBottom: 8 }}>
          <h1>{company}</h1>
          <p>{address}</p>
          <p><strong>TELÉFONO:</strong> {phone} | <strong>CORREO:</strong> {email}</p>
          <p style={{ marginTop: 4 }}><strong>NIT:</strong> {nit} | <strong>NRC:</strong> {nrc}</p>
        </div>

        <div className="doc-meta">
          <div>
            <div className="label">Tipo de Documento</div>
            <div className="value">COMPROBANTE DE CRÉDITO FISCAL</div>
          </div>
          <div>
            <div className="label">Código de Generación</div>
            <div style={{ fontSize: 8, color: '#1f2937', fontFamily: 'monospace' }}>{codigoFactura}</div>
          </div>
          <div>
            <div className="label">Fecha de Emisión</div>
            <div className="value">
              {new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 8, border: '1px solid #e5e7eb' }}>
          <div className="section-header">DATOS DEL RECEPTOR</div>
          <div className="recipient-grid">
            <div><strong>Nombre/Razón Social:</strong> {recipient.name || '---'}</div>
            <div><strong>NIT/DUI:</strong> {recipient.nit || '---'}</div>
            <div><strong>NRC:</strong> {recipient.nrc || '---'}</div>
            <div><strong>Dirección:</strong> {recipient.address || '---'}</div>
          </div>
        </div>

        <div style={{ marginBottom: 8, border: '1px solid #e5e7eb' }}>
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
                  <td style={{ fontWeight: 600 }}>{it.description || 'Producto'}</td>
                  <td style={{ textAlign: 'right' }}>${Number(it.unitPrice || it.price || 0).toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>${Number(it.total || it.subtotal || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="totals-box">
          <div>
            <span style={{ color: '#64748b' }}>Sumatoria Ventas Gravadas</span>
            <span style={{ fontWeight: 700, color: '#111827' }}>${subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div>
              <span style={{ color: '#f59e0b' }}>Descuento ({discount}%)</span>
              <span style={{ fontWeight: 700, color: '#f59e0b' }}>${(subtotal * discount / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="total-row">
            <span style={{ color: '#111827' }}>MONTO TOTAL A PAGAR</span>
            <span style={{ color: '#111827' }}>${total.toFixed(2)}</span>
          </div>
        </div>

        <div style={{ marginBottom: 8, border: '1px solid #e5e7eb' }}>
          <div className="section-header">EXTENSIÓN</div>
          <div className="extension-grid">
            <div><strong>Condición de la operación:</strong> {paymentCondition || recipient.paymentCondition || 'CONTADO'}</div>
            <div><strong>Observaciones:</strong> {observations || recipient.observations || '---'}</div>
            <div><strong>Nombre Entrega:</strong> {deliverer || recipient.deliverer || '---'}</div>
            <div><strong>Nombre Recibe:</strong> {receiver || recipient.receiver || '---'}</div>
          </div>
        </div>

        <div className="son-box">
          <div>SON:</div>
          <div className="words">{totalInWords} DÓLARES</div>
          <div className="disclaimer">Esta factura no incluye retenciones adicionales sujetas al comprador salvo que se especifique. Operación sujeta a revisión.</div>
        </div>

        <div className="no-print-buttons">
          <button className="btn-save" onClick={onSave || onPrint}>GUARDAR VENTA &amp; IMPRIMIR</button>
          <button className="btn-cancel" onClick={onCancel}>Volver al Formulario</button>
        </div>
      </div>
    </>
  );
}
