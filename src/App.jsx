import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  ShoppingCart,
  PlusCircle,
  Truck,
  TrendingUp,
  ClipboardList,
  LayoutDashboard,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  FileSpreadsheet,
  Download,
  Trash2,
  Layers,
  RotateCcw,
  Activity,
  RefreshCcw,
  Store,
  Cpu,
  FileText,
  BarChart3,
  DownloadCloud,
  ShieldCheck,
  Printer,
  Save,
  Utensils,
  Coins
} from 'lucide-react';
import * as XLSX from 'xlsx';

const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:3000/api' : '/api';

// --- Componente Universal de Inteligencia de Producto ---
const ProductIntelligenceCard = ({ product }) => {
  if (!product) return null;
  return (
      <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ 
        marginTop: '1.5rem', 
        marginBottom: '2rem',
        padding: '2rem', 
        background: 'rgba(0, 0, 0, 0.25)', 
        borderRadius: '20px', 
        border: '1px solid var(--border-light)',
        boxShadow: 'inset 0 0 20px rgba(56, 189, 248, 0.05)',
        backdropFilter: 'blur(10px)'
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1.2fr) 1fr', gap: '30px' }}>
        <div>
          <strong style={{ display: 'block', color: 'var(--accent)', marginBottom: '15px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '2px' }}>Disponibilidad por Ubicación:</strong>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
            <span style={{color: 'var(--text-muted)'}}>Ransa: <b style={{color: 'var(--text-main)'}}>{(product.stock_kg || 0).toFixed(1)}kg</b></span>
            <span style={{color: 'var(--text-muted)'}}>Lomas: <b style={{color: 'var(--accent)'}}>{(product.stock_b4 || 0).toFixed(1)}lbs</b></span>
            <span style={{color: 'var(--text-muted)'}}>Soyapango: <b style={{color: 'var(--accent)'}}>{((product.stock_b2 || 0) * 2.20462).toFixed(1)}lbs</b></span>
            <span style={{color: 'var(--text-muted)'}}>Usulután: <b style={{color: 'var(--accent)'}}>{((product.stock_b3 || 0) * 2.20462).toFixed(1)}lbs</b></span>
          </div>
        </div>
        <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '25px' }}>
          <strong style={{ display: 'block', color: 'var(--accent)', marginBottom: '15px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '2px' }}>Precios de Venta:</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
            <span>Libra: <b style={{color: 'var(--success)', fontWeight: 800}}>${(product.price_per_lb || 0).toFixed(2)}</b></span>
            <span>Kilogramo: <b style={{color: 'var(--success)', fontWeight: 800}}>${(product.price_per_kg || 0).toFixed(2)}</b></span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// --- ProductionReport ---
const ProductionReport = ({ products, onUpdate, productionLogs = [] }) => {
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    product_id: '', initial_kg: '', initial_weight: '', cut_weight: '', waste: '',
    storage_cost: '', transport_cost: '', labor_cost: '', other_costs: ''
  });

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.code && p.code.includes(searchTerm))
  );

  const handleCalcWaste = () => {
    const initLbs = parseFloat(formData.initial_weight) || 0;
    const cutLbs = parseFloat(formData.cut_weight) || 0;
    setFormData(prev => ({ 
      ...prev, 
      waste: (initLbs - cutLbs).toFixed(2) 
    }));
  };


  const handleEdit = (log) => {
    setEditingId(log.id);
    setFormData({
      product_id: log.product_id,
      initial_kg: log.initial_kg,
      initial_weight: log.initial_weight,
      cut_weight: log.cut_weight,
      waste: log.waste,
      storage_cost: log.storage_cost || '',
      transport_cost: log.transport_cost || '',
      labor_cost: log.labor_cost || '',
      other_costs: log.other_costs || ''
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const url = editingId ? `${API_BASE}/production/logs/${editingId}` : `${API_BASE}/production/process`;
    fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    }).then(() => { 
      onUpdate(); 
      setFormData({ product_id: '', initial_kg: '', initial_weight: '', cut_weight: '', waste: '', storage_cost: '', transport_cost: '', labor_cost: '', other_costs: '' }); 
      setEditingId(null);
      alert(editingId ? 'Cambios guardados correctamente' : 'Proceso registrado'); 
      if (!editingId) window.dispatchEvent(new CustomEvent('changeTab', { detail: 'distribution' }));
    });
  };

  return (
    <div className="report-content">
      <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '15px', borderRadius: '14px', marginBottom: '20px', border: '1px solid rgba(6, 182, 212, 0.3)', fontSize: '0.85rem', color: 'var(--accent)' }}>
        <Activity size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
        <strong>Monitor de Producción:</strong> Seguimiento integral de mermas y rendimiento directo en Libras.
      </div>
      
      <div className="card-grid">
        <form onSubmit={e => {
          e.preventDefault();
          const p = products.find(p => String(p.id) === String(formData.product_id));
          const body = { ...formData, product_name: p?.name || 'Unknown', date: new Date().toISOString() };
          const method = editingId ? 'PUT' : 'POST';
          const url = editingId ? `${API_BASE}/production/logs/${editingId}` : `${API_BASE}/production/logs`;
          fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(() => {
            setFormData({ product_id: '', initial_weight: '', cut_weight: '', waste: '', storage_cost: '', transport_cost: '', labor_cost: '', other_costs: '' });
            setEditingId(null);
            onUpdate();
            if (!editingId) window.dispatchEvent(new CustomEvent('changeTab', { detail: 'distribution' }));
          });
        }} className="form-card">
          <h3>Panel de Conversión & Proceso</h3>
          
          <div className="form-group">
            <label>Producto a Procesar</label>
            <select value={formData.product_id} onChange={e => setFormData({...formData, product_id: e.target.value})} required>
              <option value="">Seleccione Producto...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code}: ` : ''}{p.name}</option>)}
            </select>
            <ProductIntelligenceCard product={products.find(p => String(p.id) === String(formData.product_id))} />
          </div>

          <div className="form-row two-col">
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Entrada Técnica (Lbs)</span>
              </label>
              <input type="number" step="0.01" value={formData.initial_weight} onChange={e => {
                const w = e.target.value;
                setFormData(prev => ({...prev, initial_weight: w, waste: (parseFloat(w || 0) - parseFloat(prev.cut_weight || 0)).toFixed(2)}));
              }} placeholder="0.00" required />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Salida Limpia (Lbs)</span>
                <span style={{ color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 900, textShadow: '0 0 10px rgba(239, 68, 68, 0.3)' }}>
                  MERMA: {formData.waste || '0.00'} LBS
                </span>
              </label>
              <input type="number" step="0.01" value={formData.cut_weight} onChange={e => {
                const c = e.target.value;
                setFormData(prev => ({...prev, cut_weight: c, waste: (parseFloat(prev.initial_weight || 0) - parseFloat(c || 0)).toFixed(2)}));
              }} placeholder="0.00" required />
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
            <h4 style={{ fontSize: '0.75rem', color: 'var(--aurora-1)', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '1px', border: 'none' }}>Estimación de Costos Operativos</h4>
            <div className="form-row three-col">
              <div className="form-group">
                <label>Almacenaje ($)</label>
                <input type="number" step="0.01" value={formData.storage_cost} onChange={e => setFormData({...formData, storage_cost: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Transporte ($)</label>
                <input type="number" step="0.01" value={formData.transport_cost} onChange={e => setFormData({...formData, transport_cost: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Mano Obra ($)</label>
                <input type="number" step="0.01" value={formData.labor_cost} onChange={e => setFormData({...formData, labor_cost: e.target.value})} />
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ background: editingId ? 'var(--secondary)' : 'var(--accent)', marginTop: '20px' }}>
            {editingId ? <><Save size={18} /> Actualizar Conversión</> : <><Package size={18} /> Finalizar Producción & Conversión</>}
          </button>
          {editingId && <button type="button" onClick={() => {setEditingId(null); setFormData({ product_id: '', initial_kg: '', initial_weight: '', cut_weight: '', waste: '', storage_cost: '', transport_cost: '', labor_cost: '', other_costs: '' });}} className="btn-primary" style={{background:'#64748b', marginTop:'10px'}}>Cancelar Edición</button>}
        </form>

        <div className="form-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4>Stock para Proceso</h4>
            <motion.input 
              whileFocus={{ width: '250px', borderColor: 'var(--accent)' }}
              type="text" 
              placeholder="🔍 Buscar..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '200px', padding: '10px 18px', fontSize: '0.8rem', borderRadius: '25px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: '#fff' }}
            />
          </div>
          <div className="grid-table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th className="col-cod">Cod</th>
                  <th className="col-carne">Carne / Producto</th>
                  <th className="col-qty">Stock Disponible (Lbs)</th>
                  <th className="col-qty">Ref. Kg</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => (
                  <tr key={p.id}>
                    <td className="col-cod" style={{ fontWeight: 800, color: 'var(--text-muted)' }}>{p.code}</td>
                    <td className="col-carne" style={{ fontWeight: 700, color: 'var(--text-main)' }}>{p.name}</td>
                    <td className="col-qty" style={{ color: 'var(--success)', fontWeight: 800, fontSize: '1.1rem' }}>{((p.stock_kg || 0) * 2.20462).toFixed(2)} <small>lbs</small></td>
                    <td className="col-qty" style={{ fontWeight: 600, color: 'rgba(255,255,255,0.3)' }}>{p.stock_kg || 0} <small>kg</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="form-card" style={{ marginTop: '2.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Historial de Producción (Recientes)</h3>
        <div className="grid-table-container">
          <table>
            <thead>
              <tr>
                <th className="col-date">Fecha</th>
                <th className="col-carne">Producto</th>
                <th className="col-qty">Entrada (Lbs)</th>
                <th className="col-qty">Salida (Lbs)</th>
                <th className="col-qty">Merma</th>
                <th className="col-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productionLogs.slice().reverse().slice(0, 10).map(log => (
                <tr key={log.id} className="fade-in">
                  <td className="col-date" style={{ color: 'var(--text-muted)' }}>{new Date(log.date).toLocaleDateString()}</td>
                  <td className="col-carne" style={{ fontWeight: 700, color: 'var(--text-main)' }}>{log.product_name}</td>
                  <td className="col-qty" style={{ color: 'var(--accent)' }}>{log.initial_weight} <small>lbs</small></td>
                  <td className="col-qty" style={{ color: 'var(--secondary)', fontWeight: 800 }}>{log.cut_weight} <small>lbs</small></td>
                  <td className="col-qty" style={{ color: 'var(--danger)', fontWeight: 700 }}>-{log.waste} <small>lbs</small></td>
                  <td className="col-actions">
                    <div style={{ display:'flex', gap:'8px', justifyContent: 'center' }}>
                      <motion.button 
                        whileHover={{ scale: 1.2 }}
                        onClick={() => handleEdit(log)}
                        style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer' }}
                      >
                        <Edit2 size={14} />
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.2 }}
                        onClick={() => {
                          if(confirm('¿Eliminar registro y revertir inventario?')) {
                            fetch(`${API_BASE}/production/logs/${log.id}`, { method: 'DELETE' }).then(onUpdate);
                          }
                        }} 
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                      >
                        <Trash2 size={14} />
                      </motion.button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Componente para selector de unidad
const UnitSelector = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: '8px', background: 'rgba(15, 23, 42, 0.4)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border)' }}>
    {['Lbs', 'Kg'].map(unit => (
      <button
        key={unit}
        onClick={() => onChange(unit)}
        style={{
          flex: 1,
          padding: '8px 12px',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: 800,
          background: value === unit ? 'var(--accent)' : 'transparent',
          color: value === unit ? '#020617' : 'var(--text-muted)',
          boxShadow: value === unit ? '0 4px 12px var(--accent-glow)' : 'none'
        }}
      >
        {unit}
      </button>
    ))}
  </div>
);

// --- StatusReport ---
const StatusReport = ({ products, refreshTrigger, onUpdate }) => {
  const [inventory, setInventory] = useState([]);
  const [viewUnit, setViewUnit] = useState('Lbs');
  const [adjData, setAdjData] = useState({ product_id: '', current_stock: '', initial_stock: '', warehouse: 'Ransa' });

  useEffect(() => {
    fetch(`${API_BASE}/reports/inventory-status`).then(r => r.json()).then(setInventory);
  }, [refreshTrigger]);

  const handleAdjust = (e) => {
    e.preventDefault();
    fetch(`${API_BASE}/inventory/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adjData)
    }).then(() => { onUpdate(); setAdjData({ product_id: '', current_stock: '', initial_stock: '', warehouse: 'Ransa' }); alert('Ajuste realizado'); });
  };

  return (
    <div>
      <h3>Ajustes y Consolidado de Inventario</h3>
      <div className="card-grid">
        <form className="form-card" onSubmit={handleAdjust}>
          <h4><Edit2 size={16} /> Ajustar Stock Manualmente</h4>
          <div className="form-row two-col">
            <div className="form-group">
              <label>Producto a Ajustar</label>
              <select value={adjData.product_id} onChange={e => setAdjData({ ...adjData, product_id: e.target.value })} required>
                <option value="">Seleccione Producto...</option>
                {products.map(p => {
                  const inv = inventory.find(i => i.name === p.name);
                  return <option key={p.id} value={p.id}>{p.name} (B1:{inv?.bodega_1 || 0} | B2:{inv?.bodega_2 || 0} | B3:{inv?.bodega_3 || 0})</option>
                })}
              </select>
            </div>
            <div className="form-group">
              <label>Sede / Bodega a ajustar</label>
              <select value={adjData.warehouse} onChange={e => setAdjData({ ...adjData, warehouse: e.target.value })} required>
                {['Ransa', 'Soyapango', 'Usulután', 'Lomas de San Francisco'].map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row two-col">
            <div className="form-group">
              <label>Nuevo Stock Inicial (lbs)</label>
              <input type="number" value={adjData.initial_stock} onChange={e => setAdjData({ ...adjData, initial_stock: e.target.value })} placeholder="Meta inicial" required />
            </div>
            <div className="form-group">
              <label>Nuevo Stock Actual (lbs)</label>
              <input type="number" value={adjData.current_stock} onChange={e => setAdjData({ ...adjData, current_stock: e.target.value })} placeholder="Físico capturado" required />
            </div>
          </div>
          <button type="submit" className="btn-primary">Guardar Ajuste</button>
        </form>

        <div className="form-card" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h4 style={{ margin: 0 }}>Balance Consolidado por Bodega</h4>
            <div style={{ width: '200px' }}>
              <UnitSelector value={viewUnit} onChange={setViewUnit} />
            </div>
          </div>
          <div className="grid-table-container">
            <table>
              <thead>
                <tr>
                  <th className="col-carne">Producto</th>
                  <th className="col-qty">Ransa ({viewUnit})</th>
                  <th className="col-qty">Soyapango ({viewUnit})</th>
                  <th className="col-qty">Usulután ({viewUnit})</th>
                  <th className="col-qty">Lomas ({viewUnit})</th>
                  <th className="col-qty">Venta Global ({viewUnit})</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map(i => {
                  const isKg = viewUnit === 'Kg';
                  const factor = 2.20462;
                  
                  // B1, B2, B3 are stored as KG. B4 is stored as LBS.
                  const b1 = isKg ? (i.bodega_1 || 0) : ((i.bodega_1 || 0) * factor);
                  const b2 = isKg ? (i.bodega_2 || 0) : ((i.bodega_2 || 0) * factor);
                  const b3 = isKg ? (i.bodega_3 || 0) : ((i.bodega_3 || 0) * factor);
                  const b4 = isKg ? ((i.bodega_4 || 0) / factor) : (i.bodega_4 || 0);
                  
                  const total = b1 + b2 + b3 + b4;

                  return (
                    <tr key={i.name}>
                      <td className="col-carne" style={{ fontWeight: 700, color: 'var(--text-main)' }}>{i.name}</td>
                      <td className="col-qty" style={{ color: 'var(--accent)' }}>{b1.toFixed(1)}</td>
                      <td className="col-qty" style={{ color: 'var(--success)' }}>{b2.toFixed(1)}</td>
                      <td className="col-qty" style={{ color: 'var(--success)' }}>{b3.toFixed(1)}</td>
                      <td className="col-qty" style={{ color: 'var(--secondary)' }}>{b4.toFixed(1)}</td>
                      <td className="col-qty" style={{ background: 'rgba(14, 165, 233, 0.05)', fontWeight: 800 }}>
                        <span style={{ 
                          color: (isKg ? total * factor : total) < 20 ? 'var(--danger)' : 'var(--accent)'
                        }}>
                          {total.toFixed(1)} <small>{viewUnit.toLowerCase()}</small>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '3.5rem', padding: '2.5rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '24px', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 style={{ color: '#ef4444', margin: 0, border: 'none', fontSize: '1.2rem' }}>Protocolo de Reinicio Crítico</h4>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Esta acción vaciará todas las existencias y logs del sistema. Actúe con precaución.</p>
        </div>
        <button 
          onClick={() => {
            if (confirm('⚠️ ¿Deseas poner todas las existencias en CERO?')) {
              if (confirm('❌ ESTA ACCIÓN ES IRREVERSIBLE. ¿Continuar?')) {
                fetch(`${API_BASE}/admin/clear-inventory`, { method: 'POST' }).then(() => { onUpdate(); alert('Inventario Vaciado'); });
              }
            }
          }} 
          className="btn-danger" 
          style={{ width: 'auto' }}
        >
          <Trash2 size={20} /> Vaciar Sistema
        </button>
      </div>
    </div>
  );
};

// Helper for Total en Letras (Simplificado para el demo)
const numeroALetras = (num) => {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  // Implementación básica para mostrar el concepto
  return `${num.toFixed(2)} DÓLARES`; 
};

// --- InvoicingSystem (Paso 4) ---
const InvoicingSystem = ({ products, agros, onUpdate }) => {
  const [cart, setCart] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [agroId, setAgroId] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('Lbs');
  const [client, setClient] = useState({ name: '', nrc: '', nit: '', address: '', activity: '' });

  const addToCart = () => {
    const p = products.find(prod => String(prod.id) === String(selectedProduct));
    if (!p || !qty || !agroId) return alert('Complete los datos: Producto, Cantidad y Ubicación');
    let price = unit === 'Lbs' ? p.price_per_lb : p.price_per_kg;
    setCart([...cart, { id: Date.now(), product_id: p.id, agro_id: parseInt(agroId), name: p.name, qty: parseFloat(qty), unit, price: price || 0, total: parseFloat(qty) * (price || 0) }]);
    setSelectedProduct(''); setQty('');
  };

  const sumatoriaVentas = cart.reduce((acc, i) => acc + i.total, 0);
  const iva = sumatoriaVentas * 0.13;
  const totalPagar = sumatoriaVentas + iva;

  return (
    <div className="report-content">
      <div className="card-grid no-print">
        <div className="form-card">
          <h3>Panel de Facturación Electrónica</h3>
          <div className="form-group">
            <label>Razón Social / Nombre Cliente</label>
            <input type="text" placeholder="Ej: INDUSTRIAS BENDEK S.A DE C.V" onChange={e => setClient({...client, name: e.target.value})} />
          </div>

          <div className="form-row two-col">
            <div className="form-group"><label>NRC Cliente</label><input type="text" onChange={e => setClient({...client, nrc: e.target.value})} /></div>
            <div className="form-group"><label>NIT/DUI</label><input type="text" onChange={e => setClient({...client, nit: e.target.value})} /></div>
          </div>

          <div className="form-group">
            <label>Dirección de Envío / Fiscal</label>
            <input type="text" placeholder="Ciudad, Municipio, Departamento" onChange={e => setClient({...client, address: e.target.value})} />
          </div>

          <hr style={{ opacity: 0.1, margin: '2.5rem 0' }} />

          <div className="form-row two-col" style={{ alignItems: 'flex-start' }}>
            <div className="form-group">
              <label>Seleccionar Producto</label>
              <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                <option value="">Seleccione Producto...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code}: ` : ''}{p.name}</option>)}
              </select>
              {(() => {
                const baseProduct = products.find(p => String(p.id) === String(selectedProduct));
                if (!baseProduct) return null;
                
                const getInCartKg = (agroID) => cart
                  .filter(item => String(item.product_id) === String(selectedProduct) && String(item.agro_id) === String(agroID))
                  .reduce((acc, item) => acc + (item.unit === 'Lbs' ? item.qty / 2.20462 : item.qty), 0);
                  
                const getInCartLbs = (agroID) => cart
                  .filter(item => String(item.product_id) === String(selectedProduct) && String(item.agro_id) === String(agroID))
                  .reduce((acc, item) => acc + (item.unit === 'Kg' ? item.qty * 2.20462 : item.qty), 0);
                  
                const displayProduct = {
                  ...baseProduct,
                  stock_kg: Math.max(0, (baseProduct.stock_kg || 0) - getInCartKg(1)),
                  stock_b2: Math.max(0, (baseProduct.stock_b2 || 0) - getInCartKg(2)),
                  stock_b3: Math.max(0, (baseProduct.stock_b3 || 0) - getInCartKg(3)),
                  stock_b4: Math.max(0, (baseProduct.stock_b4 || 0) - getInCartLbs(4))
                };

                return <ProductIntelligenceCard product={displayProduct} />;
              })()}
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.65rem' }}>Cant</label>
                  <input type="number" value={qty} onChange={e => setQty(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.65rem' }}>U. Medida</label>
                  <UnitSelector value={unit} onChange={setUnit} />
                </div>
                <div style={{ flex: 1.5 }}>
                  <label style={{ fontSize: '0.65rem' }}>Ubicación Origen</label>
                  <select value={agroId} onChange={e => setAgroId(e.target.value)}>
                    <option value="">Seleccione...</option>
                    {agros.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <button onClick={addToCart} className="btn-primary" style={{ marginTop: '2rem', width: '100%' }}>
            <Activity size={18} /> Registrar Item en Detalle
          </button>
        </div>
      </div>

      {/* VISTA DE IMPRESIÓN (ESTILO CREDITO FISCAL) */}
      <div id="invoice-layout" className="invoice-container">
        
        {/* Encabezado Principal */}
        <div className="invoice-header">
          <div className="invoice-header-content">
            <h2 className="company-title">CARNES DEL PARAGUAY S.A.S DE C.V.</h2>
            <p className="company-details">
              <strong>DIRECCIÓN:</strong> CALLE LA MASCOTA, CONDOMINIO GALICIA, COLONIA SAN BENITO, 18.<br/> 
              MUNICIPIO DE SAN SALVADOR CENTRO.<br/>
              <strong>NIT:</strong> 0623-160725-114-6 | <strong>NRC:</strong> 367641-0 <br/>
              <strong>TELÉFONO:</strong> 2222-2222 | <strong>CORREO:</strong> carnesdelparaguaysasdecv@gmail.com
            </p>
          </div>
          <div className="invoice-logo">
             <div className="logo-placeholder">LOGO</div>
          </div>
        </div>

        {/* Info Documento (Sin QR) */}
        <div className="dte-info-card">
          <div className="dte-text">
            <h3 className="dte-title">DOCUMENTO TRIBUTARIO ELECTRÓNICO</h3>
            <h4 className="dte-subtitle">COMPROBANTE DE CRÉDITO FISCAL</h4>
            <div className="dte-codes">
              <span><strong>Código de Generación:</strong> {Math.random().toString(36).toUpperCase().substring(2, 10)}-ABCD-EFGH-IJKL</span><br/>
              <span><strong>Número de Control:</strong> DTE-03-M001P001-1234567890</span>
            </div>
          </div>
          <div className="date-box">
            <div className="date-label">FECHA DE EMISIÓN</div>
            <div className="date-value">{new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}</div>
          </div>
        </div>

        {/* Receptor */}
        <div className="receptor-card">
          <div className="receptor-header">DATOS DEL RECEPTOR</div>
          <div className="receptor-body">
             <div className="receptor-item"><strong>Nombre / Razón Social:</strong> <span>{client.name || '---'}</span></div>
             <div className="receptor-item"><strong>NRC:</strong> <span>{client.nrc || '---'}</span></div>
             <div className="receptor-item"><strong>NIT / DUI:</strong> <span>{client.nit || '---'}</span></div>
             <div className="receptor-item full-width"><strong>Dirección:</strong> <span>{client.address || '---'}</span></div>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="table-wrapper">
          <table className="invoice-body-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Cant</th>
                <th>Unidad</th>
                <th>Descripción de los Bienes o Servicios</th>
                <th className="right-align">P. Unitario</th>
                <th className="right-align">Ventas Gravadas</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item, idx) => (
                <tr key={item.id}>
                  <td className="center-align">{idx+1}</td>
                  <td className="center-align">{item.qty}</td>
                  <td className="center-align">{item.unit}</td>
                  <td className="desc-cell">{item.name}</td>
                  <td className="right-align">${item.price.toFixed(2)}</td>
                  <td className="right-align fw-bold">${item.total.toFixed(2)}</td>
                </tr>
              ))}
              {cart.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-row">No hay productos registrados en el detalle</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        <div className="invoice-footer-grid">
          <div className="total-letras">
            <div className="letras-title">SON:</div>
            <div className="letras-value">{numeroALetras(totalPagar)}</div>
            <div className="letras-note">Esta factura no incluye retenciones adicionales sujetas al comprador salvo que se especifique. Operación sujeta a revisión.</div>
          </div>
          <div className="total-breakdown">
            <div className="total-row"><span>Sumatoria Ventas Gravadas</span> <span>${sumatoriaVentas.toFixed(2)}</span></div>
            <div className="total-row"><span>13% IVA</span> <span>${iva.toFixed(2)}</span></div>
            <div className="total-row main-total"><span>MONTO TOTAL A PAGAR</span> <span>${totalPagar.toFixed(2)}</span></div>
          </div>
        </div>

        <div className="no-print" style={{ display:'flex', gap:'10px', marginTop:'20px' }}>
          <button 
            onClick={() => {
              if(!client.name || cart.length === 0) return alert('Datos incompletos');
              Promise.all(cart.map(item => {
                return fetch(`${API_BASE}/dispatches`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    product_id: item.product_id, 
                    agro_id: item.agro_id, 
                    weight: item.qty, 
                    unit_type: item.unit, 
                    value: item.total 
                  })
                });
              })).then(() => {
                alert('Venta guardada exitosamente. Abriendo vista de impresión...');
                window.print();
                setCart([]);
                onUpdate();
                window.dispatchEvent(new CustomEvent('changeTab', { detail: 'status' }));
              });
            }} 
            className="btn-primary" 
            style={{flex:1, background:'var(--success)', color: 'white'}}
          >
            <Printer size={18} /> Guardar Venta & Imprimir
          </button>
          <button onClick={() => setCart([])} className="btn-primary" style={{flex:1, background:'var(--danger)', color: 'white'}}>
            <Trash2 size={18} /> Cancelar Operación
          </button>
        </div>
      </div>

      <style>{`
        .invoice-container { 
          background: white; 
          padding: 40px; 
          color: #1e293b; 
          font-family: 'Inter', sans-serif; 
          max-width: 900px; 
          margin: 3rem auto; 
          border-radius: 16px; 
          box-shadow: 0 20px 40px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.05); 
          position: relative;
          overflow: hidden;
        }
        
        .invoice-container::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0; height: 8px;
          background: linear-gradient(90deg, #1e3a8a, #3b82f6);
        }

        .invoice-header { 
          display: flex; 
          justify-content: space-between; 
          align-items: flex-start;
          padding-bottom: 25px; 
          border-bottom: 2px solid #f1f5f9; 
          margin-bottom: 25px;
        }
        
        .invoice-header-content { flex: 1; }
        .company-title { color: #0f172a; margin: 0 0 8px 0; font-size: 1.5rem; font-weight: 900; letter-spacing: -0.5px; }
        .company-details { font-size: 10px; margin: 0; color: #64748b; line-height: 1.6; }
        .company-details strong { color: #334155; }
        
        .invoice-logo { margin-left: 30px; }
        .logo-placeholder { 
          width: 80px; height: 80px; 
          background: #f8fafc;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center; 
          font-size: 11px; font-weight: bold; color: #94a3b8; 
          border: 1px dashed #cbd5e1;
        }

        .dte-info-card { 
          display: flex;
          justify-content: space-between;
          background: #f8fafc; 
          border-radius: 12px;
          border: 1px solid #e2e8f0; 
          padding: 18px 25px;
          margin-bottom: 25px; 
          align-items: center;
        }
        
        .dte-text { flex: 1; }
        .dte-title { margin: 0; font-size: 14px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; }
        .dte-subtitle { margin: 4px 0 10px 0; font-size: 11px; color: #3b82f6; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;}
        .dte-codes { font-size: 9px; color: #64748b; font-family: monospace; line-height: 1.5;}
        
        .date-box { 
          text-align: right;
          padding-left: 20px;
          border-left: 1px solid #cbd5e1;
        }
        .date-label { font-size: 9px; color: #64748b; font-weight: 700; letter-spacing: 1px; margin-bottom: 4px; }
        .date-value { font-size: 13px; font-weight: 800; color: #0f172a; }

        .receptor-card { 
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          margin-bottom: 30px;
        }
        .receptor-header { 
          background: #f1f5f9; 
          color: #334155; 
          padding: 10px 20px; 
          font-weight: 800; 
          font-size: 11px;
          letter-spacing: 1px;
          border-bottom: 1px solid #e2e8f0;
        }
        .receptor-body { 
          display: grid; 
          grid-template-columns: 2fr 1fr 1fr; 
          padding: 15px 20px; 
          gap: 15px; 
          font-size: 10.5px; 
          color: #334155;
          background: white;
        }
        .receptor-item { display: flex; flex-direction: column; gap: 4px; }
        .receptor-item strong { color: #94a3b8; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
        .receptor-item span { font-weight: 600; color: #0f172a; }
        .full-width { grid-column: span 3; }

        .table-wrapper {
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          margin-bottom: 30px;
        }
        
        .invoice-body-table { 
          width: 100%; 
          border-collapse: collapse; 
          background: white;
        }
        .invoice-body-table th { 
          background: #f8fafc; 
          color: #64748b; 
          font-size: 10px; 
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 12px 15px; 
          text-align: left; 
          border-bottom: 1px solid #e2e8f0;
        }
        .invoice-body-table td { 
          font-size: 11px; 
          padding: 12px 15px; 
          color: #334155; 
          border-bottom: 1px solid #f1f5f9;
        }
        .invoice-body-table tbody tr:last-child td { border-bottom: none; }
        .invoice-body-table tbody tr:nth-child(even) td { background: #fcfcfc; }
        
        .center-align { text-align: center; }
        .right-align { text-align: right; }
        .fw-bold { font-weight: 700; color: #0f172a; }
        .empty-row { text-align: center; padding: 30px !important; color: #94a3b8; font-style: italic; }

        .invoice-footer-grid { 
          display: grid; 
          grid-template-columns: 1fr 340px; 
          gap: 30px; 
          align-items: end;
        }
        
        .total-letras { 
          background: #f8fafc;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          padding: 20px; 
        }
        .letras-title { font-size: 9px; color: #64748b; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px; }
        .letras-value { font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 15px; text-transform: uppercase; }
        .letras-note { font-size: 8.5px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 10px; line-height: 1.4; }

        .total-breakdown { 
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0; 
          overflow: hidden;
        }
        .total-row { 
          display: flex; 
          justify-content: space-between; 
          padding: 12px 20px; 
          font-size: 11px; 
          border-bottom: 1px solid #f1f5f9; 
          color: #475569;
          font-weight: 600;
        }
        .total-row:last-child { border-bottom: none; }
        .main-total { 
          background: #1e293b; 
          color: white; 
          font-weight: 800; 
          font-size: 14px; 
          padding: 16px 20px; 
        }
        .main-total span { color: white; }

        @media print { 
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; } 
          .invoice-container { 
            border: none; margin: 0; width: 100%; max-width: 100%; box-shadow: none; padding: 0; 
          } 
          .invoice-container::before { height: 12px; }
        }
      `}</style>
    </div>
  );
};

// --- ExportReport ---
const ExportReport = ({ products, agros, refreshTrigger }) => {
  const [loading, setLoading] = useState(false);
  const handleExport = async () => {
    setLoading(true);
    try {
      const resRansa = await fetch(`${API_BASE}/reports/ransa`);
      const resDispatch = await fetch(`${API_BASE}/reports/dispatches`);
      const resSales = await fetch(`${API_BASE}/sales`);
      const resInv = await fetch(`${API_BASE}/reports/inventory-status`);
      
      const ransa = await resRansa.json();
      const dispatches = await resDispatch.json();
      const sales = await resSales.json();
      const inventory = await resInv.json();

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ransa), "Entradas Ransa");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dispatches), "Despachos");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sales), "Ventas");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inventory), "Inventario");
      XLSX.writeFile(wb, `Reporte_Logistica_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error(error);
      alert("Error al exportar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <div className="form-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <DownloadCloud size={48} style={{ color: 'var(--accent)', marginBottom: '1.5rem' }} />
        <h3 style={{ border: 'none', justifyContent: 'center' }}>Consolidado de Datos</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem' }}>Genera un reporte integral en Microsoft Excel con todos los movimientos históricos.</p>
        <button onClick={handleExport} disabled={loading} className="btn-primary" style={{ background: 'var(--accent)', color: '#020617' }}>
          {loading ? 'Generando Archivo...' : 'Descargar Reporte Completo (.xlsx)'}
        </button>
      </div>
    </div>
  );
};

// --- LogisticsHub (Unificado) ---
const LogisticsHub = ({ products, agros, refreshTrigger, onUpdate, forceMode, incomeLogs = [], dispatchLogs = [] }) => {
  const [activeSubTab, setActiveSubTab] = useState(forceMode === 'unified' ? 'unified' : (forceMode === 'distribution' ? 'dispatch' : 'income'));
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ 
    product_id: '', origin: 'Ransa', destination: 'Lomas de San Francisco', 
    weight: '', tag_weight: '', scale_weight: '', units_per_box: '',
    unit_type: 'Kg', value: '', agro_id: '',
    total_to_distribute: '', distributions: {} 
  });

  // Auto-calculate total value based on unit type and specific prices
  useEffect(() => {
    if (activeSubTab === 'dispatch' && formData.product_id && formData.weight) {
      const product = products.find(p => String(p.id) === String(formData.product_id));
      if (product) {
        let price = 0;
        if (formData.unit_type === 'Lbs') price = product.price_per_lb;
        else if (formData.unit_type === 'Kg') price = product.price_per_kg;
        
        setFormData(prev => ({ ...prev, value: (parseFloat(formData.weight) * (price || 0)).toFixed(2) }));
      }
    }
  }, [formData.product_id, formData.weight, formData.unit_type, activeSubTab, products]);

  const warehouses = [
    'Ransa', 
    'Lomas de San Francisco', 
    'Central de abasto - Soyapango (Cuarto Frío)', 
    'Central de abasto - Usulután (Cuarto Frío)'
  ];

  const handleAction = (e) => {
    e.preventDefault();
    const isIncome = activeSubTab === 'income' || activeSubTab === 'unified';
    const endpoint = isIncome ? '/reports/ransa' : '/dispatches';
    const url = editingId ? `${API_BASE}${endpoint}/${editingId}` : `${API_BASE}${endpoint}`;
    
    fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isIncome ? 
        { product_id: formData.product_id, tag_weight: formData.tag_weight, scale_weight: formData.scale_weight, units_per_box: formData.units_per_box, unit_type: formData.unit_type, distribution_details: formData.destination } : 
        { product_id: formData.product_id, agro_id: formData.agro_id, weight: formData.weight, unit_type: formData.unit_type, value: formData.value, origin_warehouse: formData.origin })
    }).then(() => { 
      onUpdate(); 
      setFormData({ product_id: '', origin: 'Ransa', destination: 'Lomas de San Francisco', weight: '', tag_weight: '', scale_weight: '', units_per_box: '', unit_type: 'Lbs', agro_id: '', value: '' }); 
      setEditingId(null);
      alert(editingId ? 'Cambios actualizados correctamente' : 'Guardado correctamente');
      
      // Auto-navigation logic
      if (!editingId) {
        if (isIncome) window.dispatchEvent(new CustomEvent('changeTab', { detail: 'production' }));
        else window.dispatchEvent(new CustomEvent('changeTab', { detail: 'invoice' }));
      }
    });
  };

  const handleEdit = (log) => {
    setEditingId(log.id);
    setFormData({
      product_id: log.product_id,
      weight: log.weight || log.scale_weight || '',
      scale_weight: log.scale_weight || '',
      tag_weight: log.tag_weight || '',
      units_per_box: log.units_per_box || '',
      unit_type: log.unit_type || 'Lbs',
      agro_id: log.agro_id || '',
      value: log.value || '',
      destination: log.distribution_details || log.destination || 'Lomas de San Francisco',
      origin: log.origin_warehouse || 'Ransa'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  return (
    <div className="report-content">
      {forceMode === 'distribution' && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '2rem', justifyContent: 'center' }}>
          <button onClick={() => setActiveSubTab('dispatch')} style={{ padding:'10px 20px', borderRadius:'10px', border:'none', background: activeSubTab === 'dispatch' ? '#1e3a8a':'#f1f5f9', color: activeSubTab === 'dispatch'?'white':'#64748b', fontWeight:700, cursor:'pointer' }}>Despacho Individual</button>
          <button onClick={() => setActiveSubTab('mass')} style={{ padding:'10px 20px', borderRadius:'10px', border:'none', background: activeSubTab === 'mass' ? '#1e3a8a':'#f1f5f9', color: activeSubTab === 'mass'?'white':'#64748b', fontWeight:700, cursor:'pointer' }}>Distribución Masiva</button>
        </div>
      )}

      <form className="form-card" onSubmit={handleAction}>
        <h3>
          {activeSubTab === 'unified' ? 'Paso 1: Recepción & Traslado Inmediato' : 
           activeSubTab === 'dispatch' ? 'Paso 3: Despacho Individual' : 
           activeSubTab === 'mass' ? 'Paso 3: Distribución Masiva' :
           'Paso 3: Distribución y Venta Final'}
        </h3>
        
        <div className="form-group">
          <label>Producto</label>
          <select value={formData.product_id} onChange={e => setFormData({...formData, product_id: e.target.value})} required>
            <option value="">Seleccione...</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code}: ` : ''}{p.name}</option>)}
          </select>
          <ProductIntelligenceCard product={products.find(p => String(p.id) === String(formData.product_id))} />
        </div>

        {activeSubTab === 'unified' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>Peso según Viñeta (Kg)</label>
                <input type="number" step="0.01" value={formData.tag_weight} onChange={e => setFormData({...formData, tag_weight: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Peso según Báscula (Kg)</label>
                <input type="number" step="0.01" value={formData.scale_weight} onChange={e => setFormData({...formData, scale_weight: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Unidad</label>
                <input type="text" value="Kilogramos (KG)" readOnly style={{ background: 'rgba(15, 23, 42, 0.4)', borderColor: 'rgba(255,255,255,0.05)' }} />
              </div>
            </div>
            <div className="form-group" style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <label style={{ color: 'var(--accent)', fontWeight: 800 }}>Central de Abasto a la que se traslada:</label>
              <select 
                value={formData.destination} 
                onChange={e => setFormData({...formData, destination: e.target.value})}
                style={{ border: '2px solid var(--accent)', background: 'rgba(0,0,0,0.2)' }}
              >
                {warehouses.filter(w => w !== 'Ransa').map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>
        )}

        {activeSubTab === 'dispatch' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div className="form-group">
              <label>Punto de Entrega (Destino)</label>
              <select value={formData.agro_id} onChange={e => setFormData({...formData, agro_id: e.target.value})} required>
                <option value="">Seleccione Destino...</option>
                {agros.filter(a => a.name !== 'Ransa').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Bodega de Origen</label>
              <motion.select 
                whileFocus={{ scale: 1.05, borderColor: 'var(--accent)' }}
                value={formData.origin} 
                onChange={e => setFormData({...formData, origin: e.target.value})} 
                required 
                style={{ border: '2px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}
              >
                <option value="Ransa">Ransa</option>
                <option value="Lomas de San Francisco">Lomas de San Francisco</option>
                <option value="Soyapango">Soyapango</option>
                <option value="Usulután">Usulután</option>
              </motion.select>
            </div>
          </div>
        )}

        {(activeSubTab === 'transfer' || activeSubTab === 'dispatch') && (
          <div className="form-group">
            <label>{activeSubTab === 'dispatch' ? 'Cantidad a Despachar' : 'Peso a Mover'}</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="number" step="0.01" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} required style={{ flex: 1 }} />
              <UnitSelector value={formData.unit_type} onChange={val => setFormData({...formData, unit_type: val})} />
            </div>
          </div>
        )}

        {activeSubTab === 'dispatch' && (
          <div className="form-group">
            <label>Valor Monetario Total ($)</label>
            <input type="number" step="0.01" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} required />
          </div>
        )}

        {activeSubTab === 'mass' && (
          <div>
            <div className="form-group">
              <label>Cantidad Total a Distribuir (lbs)</label>
              <input type="number" value={formData.total_to_distribute} onChange={e => setFormData({...formData, total_to_distribute: e.target.value})} placeholder="Ej: 500" />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform:'uppercase' }}>Asignación por Destino</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                {agros.filter(a => a.name !== 'Ransa').map(a => {
                  const currentVal = formData.distributions?.[a.id] || '';
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{a.name}</span>
                      <input type="number" placeholder="lbs" value={currentVal} onChange={e => {
                        const newDist = { ...(formData.distributions || {}), [a.id]: e.target.value };
                        setFormData({...formData, distributions: newDist});
                      }} style={{ width: '100px', padding: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white', borderRadius: '8px' }} />
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ padding: '20px', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '16px', marginBottom: '15px', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Monto Total a Distribuir:</span>
                <span style={{ color: 'var(--accent)', textShadow: '0 0 10px rgba(6, 182, 212, 0.3)' }}>
                  {Object.values(formData.distributions || {}).reduce((acc, v) => acc + (parseFloat(v) || 0), 0).toFixed(2)} LBS
                </span>
              </div>
            </div>
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={activeSubTab === 'mass' && (parseFloat(Object.values(formData.distributions || {}).reduce((acc, v) => acc + (parseFloat(v) || 0), 0)) > (parseFloat(formData.total_to_distribute) || 0))}>
          {activeSubTab === 'mass' ? 'Confirmar Distribución Masiva' : 
           activeSubTab === 'unified' ? 'Recepción -> Ir a Procesos' : 
           activeSubTab === 'dispatch' ? 'Despacho -> Ir a Factura' : 'Ejecutar Paso'}
        </button>
      </form>

      <div className="form-card" style={{ marginTop: '20px' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Trazabilidad: Últimos Movimientos</h3>
        <div className="grid-table-container">
          <table>
            <thead>
              {activeSubTab === 'unified' ? (
                <tr>
                  <th className="col-date">Fecha</th>
                  <th className="col-carne">Producto</th>
                  <th className="col-qty">Kg</th>
                  <th className="col-carne">Destino</th>
                  <th className="col-actions">Acciones</th>
                </tr>
              ) : (
                <tr>
                  <th className="col-date">Fecha</th>
                  <th className="col-carne">Producto</th>
                  <th className="col-qty">Cant.</th>
                  <th className="col-carne">Destino</th>
                  <th className="col-qty">Valor</th>
                  <th className="col-actions">Acciones</th>
                </tr>
              )}
            </thead>
            <tbody>
              {(activeSubTab === 'unified' ? incomeLogs : dispatchLogs).slice().reverse().slice(0, 10).map(log => (
                <tr key={log.id} className="fade-in">
                  <td className="col-date">{new Date(log.date).toLocaleDateString()}</td>
                  <td className="col-carne" style={{ fontWeight: 700 }}>{log.product_name}</td>
                  <td className="col-qty">{activeSubTab === 'unified' ? log.scale_weight : log.weight} <small>{log.unit_type || (activeSubTab === 'unified' ? 'Kg' : 'Lbs')}</small></td>
                  <td className="col-carne" style={{ color: 'var(--accent)', fontWeight: 700 }}>{log.destination || log.agro_name || 'Central'}</td>
                  {activeSubTab !== 'unified' && <td className="col-qty">${(log.value || 0).toFixed(2)}</td>}
                  <td className="col-actions">
                    <div style={{ display:'flex', gap:'8px', justifyContent: 'center' }}>
                      <motion.button whileHover={{ scale: 1.2 }} onClick={() => handleEdit(log)} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer' }}><Edit2 size={14} /></motion.button>
                      <motion.button whileHover={{ scale: 1.2 }} onClick={() => {
                          const type = activeSubTab === 'unified' ? 'ransa' : 'dispatches';
                          if(confirm('¿Eliminar?')) { fetch(`${API_BASE}/${type === 'ransa' ? 'reports/ransa' : 'dispatches'}/${log.id}`, { method: 'DELETE' }).then(onUpdate); }
                        }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={14} /></motion.button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ConfigPanel = ({ products, onUpdate }) => {
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ code: '', name: '', category: '', price_per_lb: '' });

  const handleEdit = (p) => {
    setEditing(p.id);
    setFormData({ 
      code: p.code || '', 
      name: p.name, 
      category: p.category, 
      price_per_lb: p.price_per_lb,
      price_per_kg: p.price_per_kg,
      price_per_box: p.price_per_box
    });
  };

  const handleSave = (e) => {
    e.preventDefault();
    fetch(`${API_BASE}/products/${editing}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    }).then(() => { onUpdate(); setEditing(null); alert('Cambios guardados'); });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '10px' }}>
        <h3>Configuración de Productos y Precios</h3>
        <button onClick={() => fetch(`${API_BASE}/admin/sync-catalog`, { method: 'POST' }).then(() => { onUpdate(); alert('Sincronizado'); })} className="btn-primary" style={{ background: '#059669', width: 'auto' }}>
          🔄 Sincronizar Catálogo
        </button>
      </div>
      <div className="form-card grid-table-container">
        <table>
          <thead>
            <tr><th>Cod</th><th>Producto</th><th>$/Libras</th><th>$/Kg</th><th>Acción</th></tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td>{editing === p.id ? <input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} style={{width: 50}} /> : p.code}</td>
                <td>{editing === p.id ? <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /> : p.name}</td>
                <td>{editing === p.id ? <input type="number" step="0.01" value={formData.price_per_lb} onChange={e => setFormData({...formData, price_per_lb: e.target.value})} /> : `$${(p.price_per_lb || 0).toFixed(2)}`}</td>
                <td>{editing === p.id ? <input type="number" step="0.01" value={formData.price_per_kg} onChange={e => setFormData({...formData, price_per_kg: e.target.value})} /> : `$${(p.price_per_kg || 0).toFixed(2)}`}</td>
                <td>
                  {editing === p.id ? <button onClick={handleSave}>Guardar</button> : <button onClick={() => handleEdit(p)}><Edit2 size={16} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const FoodCostingSystem = ({ products, onUpdate, logs = [] }) => {
  const [meats, setMeats] = useState([{ product_id: '', weight: '', cost: '' }]);
  const [inputs, setInputs] = useState([{ description: '', cost: '' }]);
  const [extraData, setExtraData] = useState({
    event_name: '',
    batch_purpose: '', // Contains the "10 lbs for tacos" text
    sale_price: '',
    leftover_value: '',
    payment_status: 'Crédito',
    notes: ''
  });

  const addMeat = () => setMeats([...meats, { product_id: '', weight: '', cost: '' }]);
  const addInput = () => setInputs([...inputs, { description: '', cost: '' }]);

  const updateMeat = (idx, field, val) => {
    const newMeats = [...meats];
    newMeats[idx][field] = val;
    
    // Auto-calculate cost if we have product and weight
    if (field === 'product_id' || field === 'weight') {
      const pId = field === 'product_id' ? val : newMeats[idx].product_id;
      const w = field === 'weight' ? val : newMeats[idx].weight;
      const product = products.find(p => String(p.id) === String(pId));
      if (product && w) {
        newMeats[idx].cost = (parseFloat(w) * (product.price_per_lb || 0)).toFixed(2);
      }
    }
    
    setMeats(newMeats);
  };

  const updateInput = (idx, field, val) => {
    const newInputs = [...inputs];
    newInputs[idx][field] = val;
    setInputs(newInputs);
  };

  const totalMeatCost = meats.reduce((acc, m) => acc + (parseFloat(m.cost) || 0), 0);
  const totalInputCost = inputs.reduce((acc, i) => acc + (parseFloat(i.cost) || 0), 0);
  const totalWeight = meats.reduce((acc, m) => acc + (parseFloat(m.weight) || 0), 0);
  const totalCost = totalMeatCost + totalInputCost;
  const netBalance = (parseFloat(extraData.sale_price) || 0) - totalCost + (parseFloat(extraData.leftover_value) || 0);

  // Analytical extractions
  // Regex to try and find numerical weight in purpose (e.g. "10 lbs for tacos")
  const producedQtyMatch = extraData.batch_purpose.match(/(\d+(\.\d+)?)/);
  const producedQty = producedQtyMatch ? parseFloat(producedQtyMatch[0]) : 0;
  const yieldPercent = totalWeight > 0 ? (producedQty / totalWeight) * 100 : 0;
  const unitCost = producedQty > 0 ? (totalCost / producedQty) : 0;
  const marginPercent = (parseFloat(extraData.sale_price) || 0) > 0 ? (netBalance / parseFloat(extraData.sale_price)) * 100 : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      event_name: extraData.event_name,
      meats,
      inputs,
      total_cost: totalCost,
      sale_price: extraData.sale_price,
      leftover_value: extraData.leftover_value,
      balance: netBalance,
      date: new Date().toISOString()
    };
    
    // We send it as a unified 'batch' to the food-costing endpoint
    fetch(`${API_BASE}/food-costing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: meats[0]?.product_id || 0,
        gross_weight: meats.reduce((acc, m) => acc + (parseFloat(m.weight) || 0), 0),
        gross_cost: totalCost,
        cooked_weight: netBalance,
        json_data: JSON.stringify(data)
      })
    }).then(() => {
      onUpdate();
      setMeats([{ product_id: '', weight: '', cost: '' }]);
      setInputs([{ description: '', cost: '' }]);
      setExtraData({ event_name: '', batch_purpose: '', sale_price: '', leftover_value: '', notes: '' });
      alert('Contabilidad de lote guardada correctamente.');
    });
  };

  return (
    <div className="report-content">
      <div className="card-grid">
        <form onSubmit={handleSubmit} className="form-card" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Utensils size={24} color="var(--accent)" /> Calculadora de Lotes / Eventos
          </h3>

          <div className="form-row two-col">
            <div className="form-group">
              <label>Destino de Venta (Cliente/Institución)</label>
              <input 
                type="text" 
                value={extraData.event_name} 
                onChange={e => setExtraData({...extraData, event_name: e.target.value})} 
                placeholder="Ej: MAG, CNR, Relaciones Exteriores..." 
                required 
              />
            </div>
            <div className="form-group">
              <label>Cantidad Producida y Propósito del Lote</label>
              <input 
                type="text" 
                value={extraData.batch_purpose} 
                onChange={e => setExtraData({...extraData, batch_purpose: e.target.value})} 
                placeholder="Ej: 10 libras para tacos..." 
                required 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
            {/* SECTION: MEATS */}
            <div>
              <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '8px', fontSize: '1rem' }}>🛒 Materia Prima (Carnes)</h4>
              {meats.map((m, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <select value={m.product_id} onChange={e => updateMeat(idx, 'product_id', e.target.value)} required style={{ flex: 2 }}>
                    <option value="">Carne...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" step="0.01" placeholder="Lbs" value={m.weight} onChange={e => updateMeat(idx, 'weight', e.target.value)} style={{ flex: 1 }} />
                  <input type="number" step="0.01" placeholder="$ Costo" value={m.cost} onChange={e => updateMeat(idx, 'cost', e.target.value)} style={{ flex: 1.5 }} />
                </div>
              ))}
              <button type="button" onClick={addMeat} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--accent)', border: '1px dashed var(--accent)', padding: '5px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>+ Agregar Carne</button>
            </div>

            {/* SECTION: INPUTS */}
            <div>
              <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '8px', fontSize: '1rem' }}>🥗 Insumos y Verduras</h4>
              {inputs.map((inp, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input type="text" placeholder="Tomate, Cebolla..." value={inp.description} onChange={e => updateInput(idx, 'description', e.target.value)} style={{ flex: 2 }} />
                  <input type="number" step="0.01" placeholder="$ Costo" value={inp.cost} onChange={e => updateInput(idx, 'cost', e.target.value)} style={{ flex: 1 }} />
                </div>
              ))}
              <button type="button" onClick={addInput} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--accent)', border: '1px dashed var(--accent)', padding: '5px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>+ Agregar Insumo</button>
            </div>
          </div>

          <div style={{ marginTop: '2.5rem', padding: '25px', background: 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(34,197,94,0.08))', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.12)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.1 }}>
              <TrendingUp size={120} color="var(--accent)" />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Coins size={20} color="var(--accent)" /> 
                Análisis de Rentabilidad
              </h4>
            </div>
            
            <div className="form-row three-col">
              <div className="form-group">
                <label>Precio Venta / Crédito ($)</label>
                <input type="number" step="0.01" value={extraData.sale_price} onChange={e => setExtraData({...extraData, sale_price: e.target.value})} placeholder="0.00" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent)' }} />
              </div>
              <div className="form-group">
                <label>Valor de comida que sobró ($)</label>
                <input type="number" step="0.01" value={extraData.leftover_value} onChange={e => setExtraData({...extraData, leftover_value: e.target.value})} placeholder="0.00" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }} />
              </div>
              <div className="form-group" style={{ textAlign: 'center' }}>
                <motion.div 
                  animate={{ scale: [1, 1.05, 1] }} 
                  transition={{ repeat: Infinity, duration: 3 }}
                  style={{ fontSize: '2.5rem', lineHeight: 1, fontWeight: 950, color: netBalance >= 0 ? 'var(--success)' : '#ef4444', textShadow: netBalance >= 0 ? '0 0 25px rgba(34,197,94,0.4)' : '0 0 25px rgba(239,68,68,0.4)' }}
                >
                  ${netBalance.toFixed(2)}
                </motion.div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Margen Bruto: <b style={{ color: marginPercent > 20 ? 'var(--success)' : 'var(--warning)' }}>{marginPercent.toFixed(1)}%</b>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.5fr', gap: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px', marginTop: '20px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'var(--text-muted)' }}>Materia Prima (Carnes):</span>
                <b style={{ color: 'var(--text-main)' }}>${totalMeatCost.toFixed(2)}</b>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'var(--text-muted)' }}>Insumos Operativos:</span>
                <b style={{ color: 'var(--text-main)' }}>${totalInputCost.toFixed(2)}</b>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'var(--text-muted)' }}>Rendimiento:</span>
                <b style={{ color: yieldPercent > 50 ? 'var(--success)' : 'var(--warning)' }}>{yieldPercent.toFixed(1)}%</b>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
                <span style={{ color: 'var(--text-muted)' }}>COSTO TOTAL DE OPERACIÓN:</span>
                <b style={{ color: 'var(--accent)', fontSize: '1.2rem' }}>${totalCost.toFixed(2)}</b>
                {producedQty > 0 && <span style={{ fontSize: '0.7rem' }}>Costo unitario: <b>${unitCost.toFixed(2)}/lb fina</b></span>}
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '2rem' }}>
            <label style={{ color: 'var(--accent)', fontWeight: 800 }}>Observaciones y Detalles Finales del Lote</label>
            <textarea 
              value={extraData.notes} 
              onChange={e => setExtraData({...extraData, notes: e.target.value})} 
              placeholder="Escribe aquí cualquier detalle adicional, variaciones en costos o notas sobre la entrega..."
              style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '15px', color: 'white', minHeight: '80px', resize: 'vertical', marginTop: '8px' }}
            />
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '25px', width: '100%', padding: '18px', fontSize: '1rem', background: 'linear-gradient(to right, var(--accent), var(--secondary))' }}>
            Finalizar y Guardar Contabilidad de Lote
          </button>
        </form>
      </div>

      <div className="form-card" style={{ marginTop: '2rem' }}>
        <h3>Historial de Lotes y Despachos de Comida</h3>
        <div className="grid-table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Propósito / Cantidad</th>
                <th>Destino / Institución</th>
                <th>Costo Op. ($)</th>
                <th>Venta ($)</th>
                <th>Rend. %</th>
                <th>Utilidad ($)</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(lg => {
                let details = { event_name: 'Desconocido', batch_purpose: '-', total_cost: 0, sale_price: 0, leftover_value: 0, balance: 0 };
                try { 
                  if (lg.json_data) details = JSON.parse(lg.json_data);
                  else {
                    details.total_cost = lg.gross_cost;
                    details.balance = lg.cooked_weight;
                  }
                } catch(e) {}

                // Recalculate yield for history if possible
                const histWeightMatch = details.batch_purpose?.match(/(\d+(\.\d+)?)/);
                const hWeight = histWeightMatch ? parseFloat(histWeightMatch[0]) : 0;
                const hRawTotal = details.meats?.reduce((acc, m) => acc + (parseFloat(m.weight) || 0), 0) || 0;
                const hYield = hRawTotal > 0 ? (hWeight / hRawTotal) * 100 : 0;

                return (
                  <tr key={lg.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{new Date(lg.date).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{details.batch_purpose}</td>
                    <td style={{ fontWeight: 800 }}>{details.event_name}</td>
                    <td>${(details.total_cost || 0).toFixed(2)}</td>
                    <td style={{ color: 'var(--accent)' }}>${(details.sale_price || 0)}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hYield > 0 ? hYield.toFixed(0) + '%' : '-'}</td>
                    <td style={{ 
                      fontWeight: 900, 
                      color: (details.balance || 0) >= 0 ? 'var(--success)' : '#ef4444',
                      background: (details.balance || 0) >= 0 ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)'
                    }}>
                      ${(details.balance || 0).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- Process Stepper Component ---
const ProcessStepper = ({ currentTab }) => {
  const steps = [
    { id: 'income', label: 'Recepción', icon: <Store size={16} /> },
    { id: 'production', label: 'Procesamiento', icon: <Cpu size={16} /> },
    { id: 'distribution', label: 'Despacho', icon: <Truck size={16} /> },
    { id: 'invoice', label: 'Venta / Factura', icon: <FileText size={16} /> }
  ];

  const currentIdx = steps.findIndex(s => s.id === currentTab);
  if (currentIdx === -1) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3rem', gap: '15px' }}>
      {steps.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isActive = idx === currentIdx;
        return (
          <React.Fragment key={step.id}>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '8px',
              opacity: isActive || isCompleted ? 1 : 0.4,
              transition: 'all 0.3s ease'
            }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%', 
                background: isActive ? 'var(--accent)' : (isCompleted ? 'var(--success)' : 'rgba(255,255,255,0.05)'),
                color: isActive || isCompleted ? '#020617' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isActive ? '0 0 20px var(--accent-glow)' : 'none',
                border: isActive ? 'none' : '1px solid var(--border)'
              }}>
                {isCompleted ? <CheckCircle2 size={20} /> : step.icon}
              </div>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: isActive ? 'var(--accent)' : 'inherit' }}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div style={{ alignSelf: 'center', width: '50px', height: '2px', background: isCompleted ? 'var(--success)' : 'rgba(255,255,255,0.05)', marginTop: '-20px' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const App = () => {
  const [activeTab, setActiveTab] = useState('income');
  const [products, setProducts] = useState([]);
  const [agros, setAgros] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const [productionLogs, setProductionLogs] = useState([]);
  const [incomeLogs, setIncomeLogs] = useState([]);
  const [dispatchLogs, setDispatchLogs] = useState([]);
  const [inventorySummary, setInventorySummary] = useState([]);
  const [foodCostingLogs, setFoodCostingLogs] = useState([]);

  useEffect(() => {
    const handleTabChange = (e) => setActiveTab(e.detail);
    window.addEventListener('changeTab', handleTabChange);
    return () => window.removeEventListener('changeTab', handleTabChange);
  }, []);

  useEffect(() => {
    const fetchData = () => {
      fetch(`${API_BASE}/products`).then(r => r.json()).then(setProducts);
      fetch(`${API_BASE}/agros`).then(r => r.json()).then(setAgros);
      fetch(`${API_BASE}/production/logs`).then(r => r.json()).then(setProductionLogs);
      fetch(`${API_BASE}/reports/dispatches`).then(r => r.json()).then(setDispatchLogs);
      fetch(`${API_BASE}/reports/ransa`).then(r => r.json()).then(setIncomeLogs);
      fetch(`${API_BASE}/reports/inventory-status`).then(r => r.json()).then(setInventorySummary);
      fetch(`${API_BASE}/food-costing`).then(r => r.json()).then(setFoodCostingLogs);
    };
    fetchData();
    const inv = setInterval(fetchData, 30000);
    return () => clearInterval(inv);
  }, [refresh]);

  const triggerRefresh = () => setRefresh(prev => prev + 1);

  return (
    <div className="app-container">
      <header>
        <div className="subtitle">Carnes del Paraguay</div>
        <h1>Logística & Control de Inventario</h1>
      </header>

      <div className="global-status-banner">
        {[
          { label: 'Ransa', col: 'bodega_1' },
          { label: 'Soyapango', col: 'bodega_2' },
          { label: 'Usulután', col: 'bodega_3' },
          { label: 'Lomas', col: 'bodega_4' }
        ].map((w) => {
          const val = inventorySummary.reduce((acc, i) => acc + (parseFloat(i[w.col]) || 0), 0);
          return (
            <div key={w.col} className="status-item">
              <div className="status-label">{w.label}</div>
              <div className="status-value">{Math.round(val).toLocaleString()} <span style={{fontSize:'0.6rem', color:'var(--text-muted)'}}>LBS</span></div>
            </div>
          );
        })}
        
        <div className="status-item global">
          <div className="status-label">EXISTENCIA GLOBAL</div>
          <div className="status-value">
             {Math.round(inventorySummary.reduce((acc, i) => acc + (parseFloat(i.final_stock) || 0), 0)).toLocaleString()} <small style={{fontSize:'0.6rem'}}>LBS</small>
          </div>
        </div>

        <div className="banner-actions">
          <motion.button 
            whileHover={{ rotate: 180 }}
            onClick={triggerRefresh} 
            className="btn-primary" 
            style={{ width: '50px', height: '50px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}
          >
            <RefreshCcw size={20} />
          </motion.button>
        </div>
      </div>

      <nav className="nav-tabs">
        <button className={activeTab === 'income' ? 'active' : ''} onClick={() => setActiveTab('income')}><Store size={18} /> Recepción</button>
        <button className={activeTab === 'production' ? 'active' : ''} onClick={() => setActiveTab('production')}><Cpu size={18} /> Procesos</button>
        <button className={activeTab === 'distribution' ? 'active' : ''} onClick={() => setActiveTab('distribution')}><Truck size={18} /> Despacho</button>
        <button className={activeTab === 'invoice' ? 'active' : ''} onClick={() => setActiveTab('invoice')}><FileText size={18} /> Factura</button>
        <button className={activeTab === 'status' ? 'active' : ''} onClick={() => setActiveTab('status')}><BarChart3 size={18} /> Stock</button>
        <button className={activeTab === 'reports' ? 'active' : ''} onClick={() => setActiveTab('reports')}><DownloadCloud size={18} /> Export</button>
        <button className={activeTab === 'comida' ? 'active' : ''} onClick={() => setActiveTab('comida')}><Utensils size={18} /> Comida</button>
        <button className={activeTab === 'config' ? 'active' : ''} onClick={() => setActiveTab('config')}><ShieldCheck size={18} /> Admin</button>
      </nav>

      <main style={{ paddingBottom: '5rem' }}>
        <ProcessStepper currentTab={activeTab} />
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'income' && <LogisticsHub products={products} agros={agros} refreshTrigger={refresh} onUpdate={triggerRefresh} forceMode="unified" incomeLogs={incomeLogs} dispatchLogs={dispatchLogs} />}
            {activeTab === 'production' && <ProductionReport products={products} onUpdate={triggerRefresh} productionLogs={productionLogs} />}
            {activeTab === 'distribution' && <LogisticsHub products={products} agros={agros} refreshTrigger={refresh} onUpdate={triggerRefresh} forceMode="distribution" incomeLogs={incomeLogs} dispatchLogs={dispatchLogs} />}
            {activeTab === 'invoice' && <InvoicingSystem products={products} agros={agros} onUpdate={triggerRefresh} />}
            {activeTab === 'status' && <StatusReport products={products} refreshTrigger={refresh} onUpdate={triggerRefresh} />}
            {activeTab === 'reports' && <ExportReport products={products} agros={agros} refreshTrigger={refresh} />}
            {activeTab === 'comida' && <FoodCostingSystem products={products} onUpdate={triggerRefresh} logs={foodCostingLogs} />}
            {activeTab === 'config' && <ConfigPanel products={products} onUpdate={triggerRefresh} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.7rem', borderTop: '1px solid var(--border)', marginTop: '2rem' }}>
        🚀 Sistema de Inventario Lomas - v2.0 | Estado: <span style={{ color: 'var(--success)', fontWeight: 800 }}>ACTUALIZADO</span> (20 Abr - 13:06)
      </footer>
    </div>
  );
};

export default App;
