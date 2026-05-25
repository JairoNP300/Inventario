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
          background: #ffffff !important;
          color: #111827 !important;
          font-family: 'Segoe UI', Arial, Helvetica, sans-serif !important;
          font-size: 10px !important;
          line-height: 1.5 !important;
          padding: 12px 16px !important;
          width: 100% !important;
          max-width: 190mm !important;
          margin: 0 auto !important;
          box-sizing: border-box !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08) !important;
        }
        #invoice-preview-section {
          display: flex !important;
          justify-content: center !important;
          background: transparent !important;
          border-radius: 0;
          padding: 0;
          width: 100%;
        }
        #invoice-print-area .header-badge {
          background: linear-gradient(135deg, #1e3a5f, #2d5a87) !important;
          color: #ffffff !important;
          font-size: 9px !important;
          font-weight: 700 !important;
          letter-spacing: 1px !important;
          padding: 5px 14px !important;
          display: inline-block !important;
          margin-bottom: 12px !important;
          border-radius: 3px !important;
        }
        #invoice-print-area .company-header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: flex-start !important;
          margin-bottom: 12px !important;
          border-bottom: 2px solid #1e3a5f !important;
          padding-bottom: 10px !important;
        }
        #invoice-print-area .company-info h1 {
          font-size: 1.5rem !important;
          font-weight: 900 !important;
          color: #1e3a5f !important;
          margin: 0 0 3px 0 !important;
          letter-spacing: -0.5px !important;
        }
        #invoice-print-area .company-info p {
          margin: 2px 0 !important;
          font-size: 0.75rem !important;
          color: #4b5563 !important;
        }
        #invoice-print-area .company-right {
          text-align: right !important;
          font-size: 0.72rem !important;
          color: #374151 !important;
          white-space: nowrap !important;
        }
        #invoice-print-area .company-right strong {
          color: #1e3a5f !important;
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
          padding: 7px 8px !important;
          font-size: 9.5px !important;
          color: #111827 !important;
          background: transparent !important;
          border: 0 !important;
          border-bottom: 1px solid #e5e7eb !important;
          word-break: break-word !important;
          font-weight: 400 !important;
          text-align: left !important;
          vertical-align: middle !important;
          line-height: 1.3 !important;
        }
        #invoice-print-area thead th {
          background: #1e3a5f !important;
          color: #ffffff !important;
          font-weight: 800 !important;
          font-size: 8px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          padding: 8px 8px !important;
          border-bottom: 2px solid #2d5a87 !important;
        }
        #invoice-print-area tbody tr:hover td {
          background: #f8fafc !important;
        }
        #invoice-print-area tbody tr:last-child td {
          border-bottom: 1px solid #d1d5db !important;
        }
        .il-totals-box {
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 6px !important;
          padding: 10px 14px !important;
          width: 100% !important;
          margin-bottom: 12px !important;
          box-sizing: border-box !important;
        }
        .il-totals-box .il-row {
          display: flex !important;
          justify-content: space-between !important;
          font-size: 10px !important;
          margin-bottom: 5px !important;
          color: #374151 !important;
        }
        .il-totals-box .il-total-row {
          display: flex !important;
          justify-content: space-between !important;
          border-top: 2px solid #1e3a5f !important;
          padding-top: 6px !important;
          margin-top: 4px !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          color: #1e3a5f !important;
        }
        .il-son-box {
          padding: 10px 14px !important;
          background: #fffbeb !important;
          border: 1px solid #fde68a !important;
          border-radius: 6px !important;
          margin-bottom: 14px !important;
        }
        .il-son-box .il-son-label {
          font-size: 9px !important;
          font-weight: 700 !important;
          color: #92400e !important;
          margin-bottom: 3px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
        }
        .il-son-box .il-son-words {
          font-size: 11px !important;
          color: #78350f !important;
          font-weight: 600 !important;
          line-height: 1.5 !important;
        }
        .il-son-box .il-disclaimer {
          font-size: 7.5px !important;
          color: #a16207 !important;
          margin-top: 6px !important;
          font-style: italic !important;
        }
        .il-section-header {
          font-size: 8px !important;
          color: #ffffff !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          padding: 4px 10px !important;
          background: #1e3a5f !important;
        }
        .il-meta {
          display: flex !important;
          justify-content: space-between !important;
          margin-bottom: 12px !important;
          padding: 8px 12px !important;
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 6px !important;
        }
        .il-meta > div {
          font-size: 8px !important;
          color: #6b7280 !important;
          flex: 1 !important;
        }
        .il-meta .il-label {
          font-size: 7.5px !important;
          color: #6b7280 !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.3px !important;
        }
        .il-meta .il-value {
          font-size: 10px !important;
          font-weight: 800 !important;
          color: #111827 !important;
          margin-top: 2px !important;
        }
        .il-meta .il-value.mono {
          font-family: 'Courier New', monospace !important;
          font-size: 8.5px !important;
          font-weight: 600 !important;
          letter-spacing: 0 !important;
        }
        .il-recipient-grid {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 4px 16px !important;
          font-size: 9.5px !important;
          padding: 8px 10px !important;
          color: #111827 !important;
        }
        .il-recipient-grid > div {
          margin-bottom: 2px !important;
        }
        .il-extension-grid {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 4px 16px !important;
          padding: 8px 10px !important;
          font-size: 9.5px !important;
          color: #111827 !important;
        }
        .il-extension-grid > div {
          margin-bottom: 2px !important;
        }
        #invoice-print-area .il-no-print {
          display: flex !important;
          gap: 10px !important;
          margin-top: 14px !important;
        }
        #invoice-print-area .il-no-print button {
          flex: 1 !important;
          padding: 10px 18px !important;
          border-radius: 8px !important;
          font-weight: 700 !important;
          font-size: 11px !important;
          border: none !important;
          cursor: pointer !important;
          color: white !important;
          transition: all 0.2s !important;
        }
        #invoice-print-area .il-no-print button:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        }
        .il-btn-save { background: linear-gradient(135deg, #059669, #047857) !important; }
        .il-btn-cancel { background: linear-gradient(135deg, #64748b, #475569) !important; }
        .il-section-box {
          margin-bottom: 10px !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 6px !important;
          overflow: hidden !important;
        }
        p { margin: 0 !important; }
        @media print {
          .no-print, .no-print * { display: none !important; }
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .report-content { padding: 0 !important; margin: 0 !important; }
          .report-content > *:not(#invoice-preview-section) { display: none !important; }
          #invoice-preview-section {
            display: flex !important;
            justify-content: center !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            background: white !important;
            border-radius: 0 !important;
          }
          #invoice-print-area {
            display: block !important;
            width: 100% !important;
            max-width: 195mm !important;
            margin: 0 auto !important;
            padding: 14px 18px !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            font-size: 10px !important;
            line-height: 1.4 !important;
          }
          #invoice-print-area .header-badge { font-size: 8px !important; padding: 4px 10px !important; margin-bottom: 8px !important; }
          #invoice-print-area .company-info h1 { font-size: 1.3rem !important; margin: 0 0 2px 0 !important; }
          #invoice-print-area .company-info p { margin: 1px 0 !important; font-size: 0.7rem !important; }
          #invoice-print-area th,
          #invoice-print-area td { padding: 5px 7px !important; font-size: 9px !important; }
          #invoice-print-area thead th { padding: 6px 7px !important; font-size: 7.5px !important; }
          .il-totals-box { padding: 8px 12px !important; margin-bottom: 8px !important; }
          .il-totals-box .il-row { font-size: 9px !important; margin-bottom: 3px !important; }
          .il-totals-box .il-total-row { font-size: 12px !important; padding-top: 4px !important; }
          .il-son-box { padding: 8px 12px !important; margin-bottom: 8px !important; }
          .il-son-box .il-son-words { font-size: 10px !important; }
          .il-son-box .il-disclaimer { font-size: 7px !important; }
          .il-meta { padding: 6px 10px !important; margin-bottom: 8px !important; }
          .il-meta .il-value { font-size: 9px !important; }
          .il-meta .il-value.mono { font-size: 8px !important; }
          .il-recipient-grid { padding: 6px 8px !important; font-size: 9px !important; gap: 2px 12px !important; }
          .il-extension-grid { padding: 6px 8px !important; font-size: 9px !important; gap: 2px 12px !important; }
          .il-section-header { font-size: 7px !important; padding: 3px 8px !important; }
          .il-section-box { margin-bottom: 8px !important; }
          #invoice-print-area .il-no-print { display: none !important; }
          @page { size: A4 portrait; margin: 8mm; }
        }
      `}</style>
      <div id="invoice-print-area">
        <div className="header-badge">DOCUMENTO TRIBUTARIO ELECTRÓNICO</div>

        <div className="company-header">
          <div className="company-info">
            <h1>{company}</h1>
            <p>{address}</p>
            <p>{phone} &nbsp;|&nbsp; {email}</p>
          </div>
          <div className="company-right">
            <div><strong>NIT:</strong> {nit}</div>
            <div><strong>NRC:</strong> {nrc}</div>
            <div style={{ marginTop: 6, fontSize: '8px', color: '#6b7280' }}>Giro: Compra-Venta de Carnes</div>
          </div>
        </div>

        <div className="il-meta">
          <div>
            <div className="il-label">Tipo de Documento</div>
            <div className="il-value">COMPROBANTE DE CRÉDITO FISCAL</div>
          </div>
          <div>
            <div className="il-label">Código de Generación</div>
            <div className="il-value mono">{codigoFactura}</div>
          </div>
          <div>
            <div className="il-label">Fecha de Emisión</div>
            <div className="il-value">
              {new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>

        <div className="il-section-box">
          <div className="il-section-header">DATOS DEL RECEPTOR</div>
          <div className="il-recipient-grid">
            <div><strong>Nombre/Razón Social:</strong> {recipient.name || '---'}</div>
            <div><strong>NIT/DUI:</strong> {recipient.nit || '---'}</div>
            <div><strong>NRC:</strong> {recipient.nrc || '---'}</div>
            <div><strong>Dirección:</strong> {recipient.address || '---'}</div>
          </div>
        </div>

        <div className="il-section-box">
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
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '12px', color: '#9ca3af' }}>No hay productos registrados en el detalle</td></tr>
              )}
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: 'center', fontWeight: 500 }}>{idx + 1}</td>
                  <td style={{ textAlign: 'center' }}>{Number(it.qty || 0).toFixed(2)}</td>
                  <td style={{ textAlign: 'center' }}>{it.unit || 'Und'}</td>
                  <td style={{ fontWeight: 600 }}>{it.description || it.name || 'Producto'}</td>
                  <td style={{ textAlign: 'right' }}>${Number(it.unitPrice || it.price || 0).toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#1e3a5f' }}>${Number(it.total || it.subtotal || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="il-totals-box">
          <div className="il-row">
            <span>Sumatoria de Ventas Gravadas</span>
            <span style={{ fontWeight: 700 }}>${subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="il-row">
              <span style={{ color: '#d97706' }}>Descueto ({discount}%)</span>
              <span style={{ fontWeight: 700, color: '#d97706' }}>$ {(subtotal * discount / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="il-total-row">
            <span>MONTO TOTAL A PAGAR</span>
            <span>$ {total.toFixed(2)}</span>
          </div>
        </div>

        <div className="il-section-box">
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

        <div className="il-no-print no-print">
          <button className="il-btn-save" onClick={onSave || onPrint}>GUARDAR VENTA &amp; IMPRIMIR</button>
          <button className="il-btn-cancel" onClick={onCancel}>Volver al Formulario</button>
        </div>
      </div>
    </>
  );
}
