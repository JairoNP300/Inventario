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
  Coins,
  LogOut,
  Lock,
  MapPin,
  Bell
} from 'lucide-react';
import * as XLSX from 'xlsx';
import InvoiceLayout from './components/InvoiceLayout.jsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const API_BASE = '/api';

// Auto-refresh mechanism
let currentVersion = localStorage.getItem('app_version') || 'v1.0.0';
let updateCheckInterval = null;

// Helper fetch que incluye el rol activo en cada request
const apiFetch = (url, options = {}) => {
  const role = sessionStorage.getItem('cp_role') || 'desconocido';
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-role': role,
      ...(options.headers || {})
    }
  });
};

// ─── ROLES & CREDENCIALES ────────────────────────────────────────────────────
const ROLES = {
  // ── Administración ──────────────────────────────────────────────────────────
  admin: {
    label: 'Administrador',
    group: 'Administración',
    password: 'admin2026',
    tabs: ['income','production','distribution','invoice','status','reports','comida','monitor','config'],
    defaultTab: 'income'
  },
  // ── Soyapango ───────────────────────────────────────────────────────────────
  soyapango_puesto: {
    label: 'Soyapango — Puesto',
    group: 'Soyapango',
    password: 'soyapango',
    tabs: ['distribution'],
    defaultTab: 'distribution'
  },
  soyapango_bodega: {
    label: 'Soyapango — Bodega',
    group: 'Soyapango',
    password: 'soyapangobodega',
    tabs: ['distribution','status'],
    defaultTab: 'distribution'
  },
  // ── Usulután ────────────────────────────────────────────────────────────────
  usulutan_puesto: {
    label: 'Usulután — Puesto',
    group: 'Usulután',
    password: 'usulutan',
    tabs: ['distribution'],
    defaultTab: 'distribution'
  },
  usulutan_bodega: {
    label: 'Usulután — Bodega',
    group: 'Usulután',
    password: 'usulutanbodega',
    tabs: ['distribution','status'],
    defaultTab: 'distribution'
  },
  // ── Agromercados ────────────────────────────────────────────────────────────
  agro_quezaltepeque: {
    label: 'Agro Quezaltepeque',
    group: 'Agromercados',
    password: 'quezaltepeque',
    tabs: ['distribution'],
    defaultTab: 'distribution'
  },
  agro_aguilares: {
    label: 'Agro Aguilares',
    group: 'Agromercados',
    password: 'aguilares',
    tabs: ['distribution'],
    defaultTab: 'distribution'
  },
  agro_opico: {
    label: 'Agro Opico',
    group: 'Agromercados',
    password: 'opico',
    tabs: ['distribution'],
    defaultTab: 'distribution'
  },
  // ── Lomas de San Francisco ──────────────────────────────────────────────────
  lomas_ventas: {
    label: 'Lomas — Ventas',
    group: 'Lomas de San Francisco',
    password: 'lomasventas',
    tabs: ['distribution','comida'],
    defaultTab: 'distribution'
  },
  lomas_bodega: {
    label: 'Lomas — Bodega',
    group: 'Lomas de San Francisco',
    password: 'lomasbodega',
    tabs: ['status'],
    defaultTab: 'status'
  }
};

// Agrupar roles para mostrarlos en el login
const ROLE_GROUPS = Object.entries(ROLES).reduce((acc, [key, cfg]) => {
  if (!acc[cfg.group]) acc[cfg.group] = [];
  acc[cfg.group].push({ key, ...cfg });
  return acc;
}, {});

// ─── PANTALLA DE LOGIN ────────────────────────────────────────────────────────
const LoginScreen = ({ onLogin }) => {
  const [role, setRole] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!role) { setError('Selecciona un lugar de acceso'); return; }
    const cfg = ROLES[role];
    if (!cfg) { setError('Rol inválido'); return; }
    if (password !== cfg.password) { setError('Contraseña incorrecta'); return; }
    sessionStorage.setItem('cp_role', role);
    onLogin(role);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at 20% 50%, rgba(56,189,248,0.08), transparent 50%), radial-gradient(circle at 80% 30%, rgba(167,139,250,0.1), transparent 50%), #0f172a',
      padding: '1rem'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        style={{
          width: '100%', maxWidth: '480px',
          background: 'rgba(30,41,59,0.85)', backdropFilter: 'blur(20px)',
          borderRadius: '28px', border: '1px solid rgba(255,255,255,0.08)',
          padding: '2.5rem 2rem', boxShadow: '0 40px 80px rgba(0,0,0,0.5)'
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '16px', margin: '0 auto 1rem',
            background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 30px rgba(56,189,248,0.35)'
          }}>
            <ShieldCheck size={28} color="#fff" />
          </div>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '4px', color: '#38bdf8', textTransform: 'uppercase', marginBottom: '4px' }}>
            Carnes del Paraguay
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f8fafc', margin: 0, letterSpacing: '-0.5px' }}>
            Acceso al Sistema
          </h2>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Selector de lugar agrupado */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
              <MapPin size={11} /> Lugar de Acceso
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
              {Object.entries(ROLE_GROUPS).map(([group, items]) => (
                <div key={group}>
                  <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '6px', paddingLeft: '2px' }}>
                    {group}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {items.map(item => (
                      <div key={item.key} onClick={() => { setRole(item.key); setPassword(''); setError(''); }}
                        style={{
                          padding: '10px 14px', borderRadius: '10px', cursor: 'pointer',
                          border: `1.5px solid ${role === item.key ? '#38bdf8' : 'rgba(255,255,255,0.06)'}`,
                          background: role === item.key ? 'rgba(56,189,248,0.1)' : 'rgba(255,255,255,0.02)',
                          display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.15s'
                        }}>
                        <div style={{
                          width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                          border: `2px solid ${role === item.key ? '#38bdf8' : 'rgba(255,255,255,0.2)'}`,
                          background: role === item.key ? '#38bdf8' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {role === item.key && <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#020617' }} />}
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: role === item.key ? '#f8fafc' : '#94a3b8' }}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contraseña */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
              <Lock size={11} /> Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Ingresa tu contraseña"
                style={{
                  width: '100%', padding: '0.85rem 3rem 0.85rem 1rem', borderRadius: '12px',
                  background: 'rgba(0,0,0,0.25)', border: '1.5px solid rgba(255,255,255,0.08)',
                  color: '#fff', fontSize: '1rem', outline: 'none', boxSizing: 'border-box'
                }}
                onFocus={e => e.target.style.borderColor = '#38bdf8'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
              <button type="button" onClick={() => setShowPass(p => !p)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}>
                {showPass ? 'OCULTAR' : 'VER'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
              style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: '0.82rem', fontWeight: 600 }}>
              ⚠ {error}
            </motion.div>
          )}

          <button type="submit" style={{
            padding: '0.95rem', borderRadius: '14px', border: 'none', cursor: 'pointer', fontWeight: 800,
            fontSize: '0.88rem', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: '0.25rem',
            background: role ? 'linear-gradient(135deg, #38bdf8, #0284c7)' : 'rgba(255,255,255,0.06)',
            color: role ? '#fff' : '#475569',
            boxShadow: role ? '0 8px 25px rgba(56,189,248,0.3)' : 'none',
            transition: 'all 0.2s'
          }}>
            Ingresar al Sistema
          </button>
        </form>
      </motion.div>
    </div>
  );
};

// --- Componente Universal de Inteligencia de Producto ---
const ProductIntelligenceCard = ({ product }) => {
  if (!product) return null;
  const n = (v) => Number(v) || 0;
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
            <span style={{ color: 'var(--text-muted)' }}>Ransa: <b style={{ color: 'var(--text-main)' }}>{n(product.stock_kg).toFixed(1)}kg</b></span>
            <span style={{ color: 'var(--text-muted)' }}>Lomas: <b style={{ color: 'var(--accent)' }}>{n(product.stock_b4).toFixed(1)}lbs</b></span>
            <span style={{ color: 'var(--text-muted)' }}>Soyapango: <b style={{ color: 'var(--accent)' }}>{(n(product.stock_b2) * 2.20462).toFixed(1)}lbs</b></span>
            <span style={{ color: 'var(--text-muted)' }}>Usulután: <b style={{ color: 'var(--accent)' }}>{(n(product.stock_b3) * 2.20462).toFixed(1)}lbs</b></span>
          </div>
        </div>
        <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '25px' }}>
          <strong style={{ display: 'block', color: 'var(--accent)', marginBottom: '15px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '2px' }}>Precios de Venta:</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
            <span>Libra: <b style={{ color: 'var(--success)', fontWeight: 800 }}>${n(product.price_per_lb).toFixed(2)}</b></span>
            <span>Kilogramo: <b style={{ color: 'var(--success)', fontWeight: 800 }}>${n(product.price_per_kg).toFixed(2)}</b></span>
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

  const productsList = Array.isArray(products) ? products : [];
  const filteredProducts = productsList.filter(p =>
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
          apiFetch(url, { method, body: JSON.stringify(body) })
            .then(r => r.json())
            .then(data => {
              if (data.error) { alert('Error: ' + data.error); return; }
              setFormData({ product_id: '', initial_weight: '', cut_weight: '', waste: '', storage_cost: '', transport_cost: '', labor_cost: '', other_costs: '' });
              setEditingId(null);
              onUpdate();
              if (!editingId) window.dispatchEvent(new CustomEvent('changeTab', { detail: 'distribution' }));
            })
            .catch(err => { console.error('Error producción:', err); alert('Error de conexión'); });
        }} className="form-card">
          <h3>Panel de Conversión & Proceso</h3>

          <div className="form-group">
            <label>Producto a Procesar</label>
            <select value={formData.product_id} onChange={e => setFormData({ ...formData, product_id: e.target.value })} required>
              <option value="">Seleccione Producto...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code}: ` : ''}{p.name}</option>)}
            </select>
            <ProductIntelligenceCard product={products.find(p => String(p.id) === String(formData.product_id))} />
          </div>

          <div className="form-row two-col">
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Entrada desde Ransa (Kg)</span>
              </label>
              <input type="number" step="0.01" value={formData.initial_weight} onChange={e => {
                const w = e.target.value;
                setFormData(prev => ({ ...prev, initial_weight: w, waste: (parseFloat(w || 0) - parseFloat(prev.cut_weight || 0)).toFixed(2) }));
              }} placeholder="0.00" required />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Salida Limpia (Lbs)</span>
                <span style={{ color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 900, textShadow: '0 0 10px rgba(239, 68, 68, 0.3)' }}>
                  MERMA: {formData.waste || '0.00'} LBS
                </span>
              </label>              <input type="number" step="0.01" value={formData.cut_weight} onChange={e => {
                const c = e.target.value;
                setFormData(prev => ({ ...prev, cut_weight: c, waste: (parseFloat(prev.initial_weight || 0) - parseFloat(c || 0)).toFixed(2) }));
              }} placeholder="0.00" required />
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
            <h4 style={{ fontSize: '0.75rem', color: 'var(--aurora-1)', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '1px', border: 'none' }}>Estimación de Costos Operativos</h4>
            <div className="form-row three-col">
              <div className="form-group">
                <label>Almacenaje ($)</label>
                <input type="number" step="0.01" value={formData.storage_cost} onChange={e => setFormData({ ...formData, storage_cost: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Transporte ($)</label>
                <input type="number" step="0.01" value={formData.transport_cost} onChange={e => setFormData({ ...formData, transport_cost: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Mano Obra ($)</label>
                <input type="number" step="0.01" value={formData.labor_cost} onChange={e => setFormData({ ...formData, labor_cost: e.target.value })} />
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ background: editingId ? 'var(--secondary)' : 'var(--accent)', marginTop: '20px' }}>
            {editingId ? <><Save size={18} /> Actualizar Conversión</> : <><Package size={18} /> Finalizar Producción & Conversión</>}
          </button>
          {editingId && <button type="button" onClick={() => { setEditingId(null); setFormData({ product_id: '', initial_kg: '', initial_weight: '', cut_weight: '', waste: '', storage_cost: '', transport_cost: '', labor_cost: '', other_costs: '' }); }} className="btn-primary" style={{ background: '#64748b', marginTop: '10px' }}>Cancelar Edición</button>}
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
                {filteredProducts.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Sin stock disponible</td></tr>
                ) : (
                  filteredProducts.map(p => (
                    <tr key={p.id}>
                      <td className="col-cod" style={{ fontWeight: 800, color: 'var(--text-muted)' }}>{p.code}</td>
                      <td className="col-carne" style={{ fontWeight: 700, color: 'var(--text-main)' }}>{p.name}</td>
                      <td className="col-qty" style={{ color: 'var(--success)', fontWeight: 800, fontSize: '1.1rem' }}>{((p.stock_kg || 0) * 2.20462).toFixed(2)} <small>lbs</small></td>
                      <td className="col-qty" style={{ fontWeight: 600, color: 'rgba(255,255,255,0.3)' }}>{p.stock_kg || 0} <small>kg</small></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="form-card" style={{ marginTop: '2.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Historial de Producción</h3>
        <div className="grid-table-container">
          <table>
            <thead>
              <tr>
                <th className="col-date">Fecha</th>
                <th className="col-carne">Producto</th>
                <th className="col-qty">Entrada Ransa (Kg)</th>
                <th className="col-qty">Salida Proceso (Lbs)</th>
                <th className="col-qty">Merma (Lbs)</th>
                <th className="col-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productionLogs.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Sin registros de producción</td></tr>
              ) : (
                productionLogs.slice().reverse().map(log => (
                  <tr key={log.id} className="fade-in">
                    <td className="col-date" style={{ color: 'var(--text-muted)' }}>{new Date(log.date).toLocaleDateString()}</td>
                    <td className="col-carne" style={{ fontWeight: 700, color: 'var(--text-main)' }}>{log.product_name || '—'}</td>
                    <td className="col-qty" style={{ color: 'var(--accent)' }}>{parseFloat(log.initial_weight || 0).toFixed(2)} <small>kg</small></td>
                    <td className="col-qty" style={{ color: 'var(--secondary)', fontWeight: 800 }}>{parseFloat(log.cut_weight || 0).toFixed(2)} <small>lbs</small></td>
                    <td className="col-qty" style={{ color: 'var(--danger)', fontWeight: 700 }}>-{parseFloat(log.waste || 0).toFixed(2)} <small>lbs</small></td>
                    <td className="col-actions">
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
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
                            if (confirm('¿Eliminar registro y revertir inventario?')) {
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
                ))
              )}
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
  const toNum = (v) => Number(v) || 0;
  const productRows = Array.isArray(products) ? products : [];
  const [inventory, setInventory] = useState([]);
  const [viewUnit, setViewUnit] = useState('Lbs');
  const [adjData, setAdjData] = useState({ product_id: '', current_stock: '', warehouse: 'Ransa' });
  const [quickKg, setQuickKg] = useState('100');
  const [quickWarehouse, setQuickWarehouse] = useState('Ransa');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [quickLoading, setQuickLoading] = useState(false);
  const inventoryRows = Array.isArray(inventory) ? inventory : [];
  const warehouseOptions = [
    { label: 'Ransa (KG)', value: 'Ransa' },
    { label: 'Soyapango (Lbs)', value: 'Central de abasto - Soyapango (Cuarto Frío)' },
    { label: 'Usulután (Lbs)', value: 'Central de abasto - Usulután (Cuarto Frío)' },
    { label: 'Lomas de San Francisco (Lbs)', value: 'Lomas de San Francisco' }
  ];

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/reports/inventory-status`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { if (!cancelled) setInventory(Array.isArray(data) ? data : []); })
      .catch(err => { console.error('Error loading inventory status', err); if (!cancelled) setInventory([]); });
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  const handleAdjust = (e) => {
    e.preventDefault();
    const val = parseFloat(adjData.current_stock);
    if (isNaN(val)) { alert('Ingresa una cantidad válida'); return; }
    apiFetch(`${API_BASE}/inventory/adjust`, {
      method: 'POST',
      body: JSON.stringify({ product_id: adjData.product_id, current_stock: val, warehouse: adjData.warehouse })
    })
    .then(r => r.json())
    .then(d => { if (d.error) { alert('Error: ' + d.error); return; } onUpdate(); setAdjData({ product_id: '', current_stock: '', warehouse: 'Ransa' }); alert('Ajuste guardado'); })
    .catch(err => alert('Error de conexión: ' + err.message));
  };

  const toggleProduct = (id) => setSelectedProducts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelectedProducts(selectedProducts.length === productRows.length ? [] : productRows.map(p => p.id));

  const handleQuickLoad = async () => {
    const kg = parseFloat(quickKg);
    if (isNaN(kg) || kg <= 0) { alert('Ingresa una cantidad válida en KG'); return; }
    if (selectedProducts.length === 0) { alert('Selecciona al menos un producto'); return; }
    setQuickLoading(true);
    const isRansa = quickWarehouse === 'Ransa';
    const valueToStore = isRansa ? kg : kg * 2.20462;
    try {
      for (const pid of selectedProducts) {
        const r = await apiFetch(`${API_BASE}/inventory/adjust`, {
          method: 'POST',
          body: JSON.stringify({ product_id: pid, current_stock: valueToStore, warehouse: quickWarehouse })
        });
        const d = await r.json();
        if (d.error) throw new Error(d.error);
      }
      onUpdate(); setSelectedProducts([]);
      alert(`✅ ${selectedProducts.length} producto(s) actualizados con ${kg} KG`);
    } catch (err) { alert('Error: ' + err.message); }
    setQuickLoading(false);
  };

  return (
    <div>
      <h3>Ajustes y Consolidado de Inventario</h3>

      {/* === CARGA RÁPIDA === */}
      <div className="form-card" style={{ marginBottom: '2rem', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.2)' }}>
        <h4 style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Package size={18} /> Carga Rápida por Lotes
        </h4>
        <div className="grid-3col" style={{ marginBottom: '1rem' }}>
          <div className="form-group">
            <label>Cantidad (KG)</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['100', '200', '300', '500'].map(v => (
                <button key={v} type="button" onClick={() => setQuickKg(v)} style={{ padding: '8px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', background: quickKg === v ? 'var(--accent)' : 'rgba(255,255,255,0.07)', color: quickKg === v ? '#020617' : 'var(--text-muted)' }}>{v} kg</button>
              ))}
              <input type="number" value={quickKg} onChange={e => setQuickKg(e.target.value)} placeholder="Otro..." style={{ width: '90px', padding: '8px 10px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', color: '#fff', fontSize: '0.9rem' }} />
            </div>
          </div>
          <div className="form-group">
            <label>Bodega Destino</label>
            <select value={quickWarehouse} onChange={e => setQuickWarehouse(e.target.value)}>
              {warehouseOptions.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ justifyContent: 'flex-end' }}>
            <label style={{ opacity: 0 }}>.</label>
            <button type="button" onClick={handleQuickLoad} disabled={quickLoading} className="btn-primary" style={{ background: 'linear-gradient(135deg, var(--success), #059669)' }}>
              {quickLoading ? 'Guardando...' : `Aplicar a ${selectedProducts.length} producto(s)`}
            </button>
          </div>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '14px', padding: '1rem', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Seleccionar Productos</span>
            <button type="button" onClick={toggleAll} style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.05)', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
              {selectedProducts.length === productRows.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {productRows.map(p => {
              const inv = inventoryRows.find(i => i.name === p.name);
              const isSelected = selectedProducts.includes(p.id);
              return (
                <div key={p.id} onClick={() => toggleProduct(p.id)} style={{ padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-light)'}`, background: isSelected ? 'rgba(56,189,248,0.1)' : 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border-light)'}`, background: isSelected ? 'var(--accent)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isSelected && <span style={{ color: '#020617', fontSize: '10px', fontWeight: 900 }}>✓</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.2 }}>{p.code}: {p.name.length > 22 ? p.name.slice(0, 22) + '…' : p.name}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Ransa: {toNum(inv?.bodega_1).toFixed(1)} kg</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* === AJUSTE INDIVIDUAL + TABLA === */}
      <div className="card-grid">
        <form className="form-card" onSubmit={handleAdjust}>
          <h4><Edit2 size={16} /> Ajuste Individual</h4>
          <div className="form-group">
            <label>Producto</label>
            <select value={adjData.product_id} onChange={e => setAdjData({ ...adjData, product_id: e.target.value })} required>
              <option value="">Seleccione Producto...</option>
              {productRows.map(p => {
                const inv = inventoryRows.find(i => i.name === p.name);
                return <option key={p.id} value={p.id}>{p.code}: {p.name} — {toNum(inv?.bodega_1).toFixed(1)} kg</option>;
              })}
            </select>
          </div>
          <div className="form-group">
            <label>Bodega</label>
            <select value={adjData.warehouse} onChange={e => setAdjData({ ...adjData, warehouse: e.target.value })} required>
              {warehouseOptions.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Nuevo Stock ({adjData.warehouse === 'Ransa' ? 'KG' : 'Lbs'})</label>
            <input type="number" step="0.01" value={adjData.current_stock} onChange={e => setAdjData({ ...adjData, current_stock: e.target.value })} placeholder={adjData.warehouse === 'Ransa' ? 'Ej: 150 kg' : 'Ej: 330 lbs'} required />
          </div>
          <button type="submit" className="btn-primary">Guardar Ajuste</button>
        </form>

        <div className="form-card" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h4 style={{ margin: 0 }}>Balance Consolidado por Bodega</h4>
            <div style={{ width: '200px' }}><UnitSelector value={viewUnit} onChange={setViewUnit} /></div>
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
                  <th className="col-qty">Total ({viewUnit})</th>
                </tr>
              </thead>
              <tbody>
                {inventoryRows.length > 0 ? inventoryRows.map(i => {
                  const isKg = viewUnit === 'Kg';
                  const factor = 2.20462;
                  // bodega_1 = KG, bodega_2/3/4 = LBS
                  const b1 = isKg ? toNum(i.bodega_1) : toNum(i.bodega_1) * factor;
                  const b2 = isKg ? toNum(i.bodega_2) / factor : toNum(i.bodega_2);
                  const b3 = isKg ? toNum(i.bodega_3) / factor : toNum(i.bodega_3);
                  const b4 = isKg ? toNum(i.bodega_4) / factor : toNum(i.bodega_4);
                  const total = b1 + b2 + b3 + b4;
                  return (
                    <tr key={i.name}>
                      <td className="col-carne" style={{ fontWeight: 700, color: 'var(--text-main)' }}>{i.name}</td>
                      <td className="col-qty" style={{ color: 'var(--accent)' }}>{b1.toFixed(1)}</td>
                      <td className="col-qty" style={{ color: 'var(--success)' }}>{b2.toFixed(1)}</td>
                      <td className="col-qty" style={{ color: 'var(--success)' }}>{b3.toFixed(1)}</td>
                      <td className="col-qty" style={{ color: 'var(--secondary)' }}>{b4.toFixed(1)}</td>
                      <td className="col-qty" style={{ background: 'rgba(14,165,233,0.05)', fontWeight: 800 }}>
                        <span style={{ color: total < 20 ? 'var(--danger)' : 'var(--accent)' }}>{total.toFixed(1)} <small>{viewUnit.toLowerCase()}</small></span>
                      </td>
                    </tr>
                  );
                }) : <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Sin datos de inventario</td></tr>}
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
            if (inventoryRows.length === 0) { alert('El inventario ya está en cero.'); return; }
            if (confirm('⚠️ ¿Deseas poner todas las existencias en CERO?')) {
              if (confirm('❌ ESTA ACCIÓN ES IRREVERSIBLE. ¿Continuar?')) {
                fetch(`${API_BASE}/admin/clear-inventory`, { method: 'POST' }).then(() => { onUpdate(); alert('Inventario Vaciado'); });
              }
            }
          }}
          className="btn-danger" style={{ width: 'auto' }}
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
// React is already imported at the top of this file
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
  const printableItems = cart.map(ci => ({ qty: ci.qty, unit: ci.unit, description: ci.name, unitPrice: ci.price, total: ci.total }));
  const saveAndPrint = () => {
    if (!client.name || cart.length === 0) {
      alert('Datos incompletos');
      return;
    }

    console.log('Saving invoice with cart:', cart);
    
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
      }).then(res => {
        if (!res.ok) throw new Error('Error saving dispatch');
        return res.json();
      });
    })).then(results => {
      console.log('All dispatches saved:', results);
      alert('Venta guardada exitosamente. Abriendo vista de impresión...');
      window.print();
      setCart([]);
      onUpdate();
      window.dispatchEvent(new CustomEvent('changeTab', { detail: 'status' }));
    }).catch(err => {
      console.error('Error saving invoice:', err);
      alert('Error al guardar la venta: ' + err.message);
    });
  };

  const companyInfo = {
    name: 'CARNES DEL PARAGUAY S.A.S DE C.V',
    address: 'CALLE LA MASCOTA, CONDOMINIO GALICIA, COLONIA SAN BENITO, 18',
    nit: '0623-160725-114-6',
    nrc: '367641-0'
  };

  return (
    <div className="report-content">
      <div className="card-grid no-print">
        <div className="form-card">
          <h3>Panel de Facturación Electrónica</h3>
          <div className="form-group">
            <label>Razón Social / Nombre Cliente</label>
            <input type="text" placeholder="Ej: INDUSTRIAS BENDEK S.A DE C.V" value={client.name} onChange={e => setClient({ ...client, name: e.target.value })} />
          </div>
          <div className="form-row two-col" style={{ marginTop: '10px' }}>
            <div className="form-group">
              <label>NIT / DUI</label>
              <input type="text" placeholder="0000-000000-000-0" value={client.nit} onChange={e => setClient({ ...client, nit: e.target.value })} />
            </div>
            <div className="form-group">
              <label>NRC</label>
              <input type="text" placeholder="367641-0" value={client.nrc} onChange={e => setClient({ ...client, nrc: e.target.value })} />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '10px' }}>
            <label>Dirección Completa</label>
            <input type="text" placeholder="Colonia San Benito..." value={client.address} onChange={e => setClient({ ...client, address: e.target.value })} />
          </div>

          <hr style={{ opacity: 0.1, margin: '2.5rem 0' }} />

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
            <label>Cantidad</label>
            <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="Ingrese cantidad" />
          </div>
          <div className="form-row two-col">
            <div className="form-group">
              <label>U. Medida</label>
              <UnitSelector value={unit} onChange={setUnit} />
            </div>
            <div className="form-group">
              <label>Ubicación Origen</label>
              <select value={agroId} onChange={e => setAgroId(e.target.value)}>
                <option value="">Seleccione...</option>
                {agros.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ background: 'var(--accent)', color: '#020617' }}
              onClick={addToCart}
            >
              <PlusCircle size={16} /> Agregar al detalle
            </button>
          </div>
        </div>
      </div>
      <InvoiceLayout
        company={companyInfo.name}
        address={companyInfo.address}
        nit={companyInfo.nit}
        nrc={companyInfo.nrc}
        recipient={client}
        date={new Date().toISOString()}
        items={printableItems}
        totals={{ subtotal: sumatoriaVentas, tax: iva, total: totalPagar }}
        onPrint={() => window.print()}
        onSave={saveAndPrint}
        onCancel={() => setCart([])}
      />

    </div>
  );
};

// --- FoodReport Component (Printable Audit) ---
const FoodReport = ({ data, products = [], onBack }) => {
  if (!data) return null;
  const [isCapturing, setIsCapturing] = useState(false);

  let details = {};
  try {
    details = typeof data.json_data === 'string' ? JSON.parse(data.json_data) : (data.json_data || {});
  } catch (e) {
    details = data.json_data || {};
  }

  // Safe numeric conversion
  const n = (val) => parseFloat(val) || 0;

  // Calculations
  const meatTotal = (details.meats || []).reduce((acc, m) => acc + n(m.weight), 0);
  const purposeText = String(details.batch_purpose || '');
  const cookedWeightMatch = purposeText.match(/(\d+(\.\d+)?)/);
  const cookedWeight = cookedWeightMatch ? n(cookedWeightMatch[0]) : (n(details.cooked_weight));

  const totalRawCost = (details.meats || []).reduce((acc, m) => acc + n(m.cost), 0);
  const totalInputCost = (details.inputs || []).reduce((acc, i) => acc + n(i.cost), 0);
  const salePrice = n(details.sale_price);
  const leftoverValue = n(details.leftover_value);

  const totalOperationalCost = totalRawCost + totalInputCost;
  const netUtility = salePrice - totalOperationalCost + leftoverValue;

  const yieldPercent = meatTotal > 0 ? (cookedWeight / meatTotal) * 100 : 0;
  const unitCost = cookedWeight > 0 ? (totalOperationalCost / cookedWeight) : 0;
  const marginPercent = salePrice > 0 ? (netUtility / salePrice) * 100 : 0;
  const isLoss = netUtility < 0;

  // Prepare a lightweight printable invoice data (for unified layout)
  const items = (details.meats || []).map((m, idx) => ({
    qty: Number(m.weight) || 0,
    unit: 'Lbs',
    description: m.name || m.product_name || `Producto ${idx + 1}`,
    unitPrice: Number(m.cost) || 0,
    total: (Number(m.weight) || 0) * (Number(m.cost) || 0)
  }));
  const recipient = {
    name: details?.recipient?.name,
    nit: details?.recipient?.nit,
    nrc: details?.recipient?.nrc,
    address: details?.recipient?.address
  };
  const docDate = data.date || new Date().toISOString();
  const subtotal = items.reduce((a, it) => a + (it.total || 0), 0);
  const tax = subtotal * 0.13;
  const total = subtotal + tax;

  const handleDownloadPDF = async () => {
    setIsCapturing(true);
    setTimeout(async () => {
      const element = document.getElementById('audit-print-zone');
      try {
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#020617' });
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Auditoria_Lote_${new Date(data.date).toISOString().split('T')[0]}.pdf`);
      } catch (err) {
        console.error("PDF generation failed", err);
        alert("Error al generar PDF.");
      }
      setIsCapturing(false);
    }, 100);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="report-screen-wrapper"
    >
      <div className="no-print report-actions-bar">
        <button onClick={onBack} className="btn-back">
          <ShieldCheck size={20} /> Salir de Auditoría
        </button>
        <button onClick={handleDownloadPDF} disabled={isCapturing} className="btn-print-action">
          <Download size={20} /> {isCapturing ? 'Generando PDF...' : 'Descargar como PDF'}
        </button>
      </div>

      <div id="audit-print-zone" className="audit-dashboard-container" style={{ padding: '20px', borderRadius: '16px' }}>
        {/* Header Elegante */}
        <div className="audit-header">
          <div className="header-badge">DOCUMENTO DE AUDITORÍA OPERACIONAL</div>
          <h1 className="header-company">CARNES DEL PARAGUAY</h1>
          <p className="header-subtitle">Control de Rendimiento Técnico y Rentabilidad Financiera</p>
          <div className="header-meta">
            <div className="meta-item"><span>Destino:</span> <strong>{details.event_name || 'Sin Asignar'}</strong></div>
            <div className="meta-item"><span>Fecha:</span> <strong>{new Date(data.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></div>
            <div className="meta-item"><span>Pago/Estado:</span> <strong>{details.payment_status || 'Por defecto'}</strong></div>
            <div className="meta-item"><span>Propósito:</span> <strong>{details.batch_purpose || 'General'}</strong></div>
          </div>
        </div>

        {/* KPI Metrics Bar */}
        <div className="metrics-grid">
          <div className="metric-card gold">
            <div className="metric-icon"><Layers size={20} /></div>
            <div className="metric-info">
              <span className="metric-label">Materia Prima</span>
              <span className="metric-value">{meatTotal.toFixed(2)} <small>Lbs</small></span>
            </div>
          </div>
          <div className="metric-card blue">
            <div className="metric-icon"><Utensils size={20} /></div>
            <div className="metric-info">
              <span className="metric-label">Producto Final</span>
              <span className="metric-value">{cookedWeight.toFixed(2)} <small>Lbs</small></span>
            </div>
          </div>
          <div className="metric-card purple">
            <div className="metric-icon"><Activity size={20} /></div>
            <div className="metric-info">
              <span className="metric-label">Rendimiento</span>
              <span className="metric-value">{yieldPercent.toFixed(1)}%</span>
            </div>
          </div>
          <div className="metric-card cyan">
            <div className="metric-icon"><Coins size={20} /></div>
            <div className="metric-info">
              <span className="metric-label">Costo por libra</span>
              <span className="metric-value">${unitCost.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Utility Hero Card */}
        <div className={`utility-badge ${isLoss ? 'loss' : 'profit'}`}>
          <div className="utility-label">{isLoss ? 'PÉRDIDA OPERACIONAL' : 'UTILIDAD TOTAL DEL LOTE'}</div>
          <div className="utility-value">${Math.abs(netUtility).toFixed(2)}</div>
          <div className="utility-progress">
            <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, marginPercent))}%` }}></div>
          </div>
        </div>

        {/* Tables Section */}
        <div className="two-column-audit">
          <div className="audit-section">
            <h3 className="section-title">Análisis de Costos Directos</h3>
            <table className="audit-table">
              <thead>
                <tr><th>Detalle Materia Prima</th><th className="right">Lbs</th><th className="right">Costo</th></tr>
              </thead>
              <tbody>
                {(details.meats || []).map((m, i) => {
                  const pName = m.product_name || products.find(p => String(p.id) === String(m.product_id))?.name || 'Producto no especificado';
                  return (
                    <tr key={i}>
                      <td>{pName}</td>
                      <td className="right">{n(m.weight).toFixed(2)}</td>
                      <td className="right fw-bold">${n(m.cost).toFixed(2)}</td>
                    </tr>
                  );
                })}
                <tr className="subtotal-row">
                  <td colSpan="2">TOTAL MATERIA PRIMA</td>
                  <td className="right">${totalRawCost.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            {details.inputs?.length > 0 && details.inputs[0].description && (
              <table className="audit-table" style={{ marginTop: '20px' }}>
                <thead>
                  <tr><th>Insumos Operativos</th><th className="right">Costo</th></tr>
                </thead>
                <tbody>
                  {details.inputs.map((inp, i) => (
                    <tr key={i}>
                      <td>{inp.description}</td>
                      <td className="right fw-bold">${n(inp.cost).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="subtotal-row grey">
                    <td>TOTAL INSUMOS / VARIOS</td>
                    <td className="right">${totalInputCost.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          <div className="audit-section">
            <h3 className="section-title">Resumen Financiero</h3>
            <div className="summary-card">
              <div className="summary-item">
                <span>Costo Total de Operación:</span>
                <span className="val-red">-${totalOperationalCost.toFixed(2)}</span>
              </div>
              <div className="summary-item">
                <span>Ingresos por Venta / Crédito:</span>
                <span className="val-green">+${salePrice.toFixed(2)}</span>
              </div>
              <div className="summary-item">
                <span>Valor Residual (Sobrante):</span>
                <span className="val-green">+${leftoverValue.toFixed(2)}</span>
              </div>
              <div className="summary-divider"></div>
              <div className="summary-item total">
                <span>RESULTADO FINAL:</span>
                <span className={isLoss ? 'val-red' : 'val-green'}>
                  {isLoss ? '-' : '+'}${Math.abs(netUtility).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="notes-box">
              <strong>NOTAS DE AUDITORÍA:</strong>
              <p>{details.notes || 'No se registraron observaciones adicionales para este lote específico.'}</p>
            </div>
          </div>
        </div>


      </div>

      <style>{`
        @media print {
          .no-print, .btn-back, .report-actions-bar { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          .audit-dashboard-container { 
            box-shadow: none !important; border: none !important; margin: 0 !important; width: 100% !important; max-width: 100% !important;
          }
          .utility-badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .metrics-grid .metric-card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </motion.div>
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
    unit_type: 'Lbs', value: '', agro_id: '',
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

    apiFetch(url, {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify(isIncome ?
        { product_id: formData.product_id, tag_weight: formData.tag_weight, scale_weight: formData.scale_weight, units_per_box: formData.units_per_box, unit_type: formData.unit_type, distribution_details: formData.destination } :
        { product_id: formData.product_id, agro_id: formData.agro_id, weight: formData.weight, unit_type: formData.unit_type, value: formData.value, origin_warehouse: formData.origin })
    })
    .then(r => r.json())
    .then(data => {
      if (data.error) { alert('Error: ' + data.error); return; }
      setFormData({ product_id: '', origin: 'Ransa', destination: 'Lomas de San Francisco', weight: '', tag_weight: '', scale_weight: '', units_per_box: '', unit_type: 'Lbs', agro_id: '', value: '' });
      setEditingId(null);
      onUpdate();
      alert(editingId ? 'Cambios actualizados correctamente' : 'Guardado correctamente');

      // Auto-navigation logic
      if (!editingId) {
        if (isIncome) window.dispatchEvent(new CustomEvent('changeTab', { detail: 'production' }));
        else window.dispatchEvent(new CustomEvent('changeTab', { detail: 'invoice' }));
      }
    })
    .catch(err => { console.error('Error en handleAction:', err); alert('Error de conexión: ' + err.message); });
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
          <button onClick={() => setActiveSubTab('dispatch')} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: activeSubTab === 'dispatch' ? '#1e3a8a' : '#f1f5f9', color: activeSubTab === 'dispatch' ? 'white' : '#64748b', fontWeight: 700, cursor: 'pointer' }}>Despacho Individual</button>
          <button onClick={() => setActiveSubTab('mass')} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: activeSubTab === 'mass' ? '#1e3a8a' : '#f1f5f9', color: activeSubTab === 'mass' ? 'white' : '#64748b', fontWeight: 700, cursor: 'pointer' }}>Distribución Masiva</button>
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
          <select value={formData.product_id} onChange={e => setFormData({ ...formData, product_id: e.target.value })} required>
            <option value="">Seleccione...</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code}: ` : ''}{p.name}</option>)}
          </select>
          <ProductIntelligenceCard product={products.find(p => String(p.id) === String(formData.product_id))} />
        </div>

        {activeSubTab === 'unified' && (
          <div>
            <div className="grid-3col">
              <div className="form-group">
                <label>Peso según Viñeta (Kg)</label>
                <input type="number" step="0.01" value={formData.tag_weight} onChange={e => setFormData({ ...formData, tag_weight: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Peso según Báscula (Kg)</label>
                <input type="number" step="0.01" value={formData.scale_weight} onChange={e => setFormData({ ...formData, scale_weight: e.target.value })} required />
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
                onChange={e => setFormData({ ...formData, destination: e.target.value })}
                style={{ border: '2px solid var(--accent)', background: 'rgba(0,0,0,0.2)' }}
              >
                {warehouses.filter(w => w !== 'Ransa').map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>
        )}

        {activeSubTab === 'dispatch' && (
          <div className="grid-2col">
            <div className="form-group">
              <label>Punto de Entrega (Destino)</label>
              <select value={formData.agro_id} onChange={e => setFormData({ ...formData, agro_id: e.target.value })} required>
                <option value="">Seleccione Destino...</option>
                {agros.filter(a => a.name !== 'Ransa').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Bodega de Origen</label>
              <motion.select
                whileFocus={{ scale: 1.05, borderColor: 'var(--accent)' }}
                value={formData.origin}
                onChange={e => setFormData({ ...formData, origin: e.target.value })}
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
              <input type="number" step="0.01" value={formData.weight} onChange={e => setFormData({ ...formData, weight: e.target.value })} required style={{ flex: 1 }} />
              <UnitSelector value={formData.unit_type} onChange={val => setFormData({ ...formData, unit_type: val })} />
            </div>
          </div>
        )}

        {activeSubTab === 'dispatch' && (
          <div className="form-group">
            <label>Valor Monetario Total ($)</label>
            <input type="number" step="0.01" value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} required />
          </div>
        )}

        {activeSubTab === 'mass' && (
          <div>
            <div className="form-group">
              <label>Cantidad Total a Distribuir (lbs)</label>
              <input type="number" value={formData.total_to_distribute} onChange={e => setFormData({ ...formData, total_to_distribute: e.target.value })} placeholder="Ej: 500" />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Asignación por Destino</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                {agros.filter(a => a.name !== 'Ransa').map(a => {
                  const currentVal = formData.distributions?.[a.id] || '';
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{a.name}</span>
                      <input type="number" placeholder="lbs" value={currentVal} onChange={e => {
                        const newDist = { ...(formData.distributions || {}), [a.id]: e.target.value };
                        setFormData({ ...formData, distributions: newDist });
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
                  <th className="col-qty">Peso Viñeta (Kg)</th>
                  <th className="col-qty">Peso Báscula (Kg)</th>
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
              {(activeSubTab === 'unified' ? incomeLogs : dispatchLogs).length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Sin movimientos registrados</td></tr>
              ) : (
                (activeSubTab === 'unified' ? incomeLogs : dispatchLogs).slice().reverse().map(log => (
                  <tr key={log.id} className="fade-in">
                    <td className="col-date">{new Date(log.date).toLocaleDateString()}</td>
                    <td className="col-carne" style={{ fontWeight: 700 }}>{log.product_name || '—'}</td>
                    {activeSubTab === 'unified' ? (
                      <>
                        <td className="col-qty">{parseFloat(log.tag_weight || 0).toFixed(2)} <small>Kg</small></td>
                        <td className="col-qty">{parseFloat(log.scale_weight || 0).toFixed(2)} <small>Kg</small></td>
                        <td className="col-carne" style={{ color: 'var(--accent)', fontWeight: 700 }}>{log.distribution_details || log.destination || 'Central'}</td>
                      </>
                    ) : (
                      <>
                        <td className="col-qty">{parseFloat(log.weight || 0).toFixed(2)} <small>{log.unit_type || 'Lbs'}</small></td>
                        <td className="col-carne" style={{ color: 'var(--accent)', fontWeight: 700 }}>{log.agro_name || log.destination || '—'}</td>
                        <td className="col-qty">${parseFloat(log.value || 0).toFixed(2)}</td>
                      </>
                    )}
                    <td className="col-actions">
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <motion.button whileHover={{ scale: 1.2 }} onClick={() => handleEdit(log)} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer' }}><Edit2 size={14} /></motion.button>
                        <motion.button whileHover={{ scale: 1.2 }} onClick={() => {
                          const type = activeSubTab === 'unified' ? 'ransa' : 'dispatches';
                          if (confirm('¿Eliminar?')) { fetch(`${API_BASE}/${type === 'ransa' ? 'reports/ransa' : 'dispatches'}/${log.id}`, { method: 'DELETE' }).then(onUpdate); }
                        }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={14} /></motion.button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ConfigPanel = ({ products, onUpdate }) => {
  const toNum = (v) => Number(v) || 0;
  const productRows = Array.isArray(products) ? products : [];
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
            {productRows.map(p => (
              <tr key={p.id}>
                <td>{editing === p.id ? <input value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} style={{ width: 50 }} /> : p.code}</td>
                <td>{editing === p.id ? <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /> : p.name}</td>
                <td>{editing === p.id ? <input type="number" step="0.01" value={formData.price_per_lb} onChange={e => setFormData({ ...formData, price_per_lb: e.target.value })} /> : `$${toNum(p.price_per_lb).toFixed(2)}`}</td>
                <td>{editing === p.id ? <input type="number" step="0.01" value={formData.price_per_kg} onChange={e => setFormData({ ...formData, price_per_kg: e.target.value })} /> : `$${toNum(p.price_per_kg).toFixed(2)}`}</td>
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

class TabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="form-card" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
          <h3 style={{ color: '#ef4444' }}>Error al abrir esta pestaña</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            Ocurrió un error inesperado en el renderizado. Presiona refrescar y vuelve a intentar.
          </p>
          <button className="btn-primary" onClick={this.props.onRetry} style={{ width: 'auto' }}>
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const FoodCostingSystem = ({ products, onUpdate, logs = [] }) => {
  const [meats, setMeats] = useState([{ product_id: '', weight: '', cost: '' }]);
  const [inputs, setInputs] = useState([{ description: '', cost: '' }]);
  const [extraData, setExtraData] = useState({
    event_name: '',
    batch_purpose: '', // Contains the "10 lbs for tacos" text
    sale_price: '',
    leftover_value: '',
    unit_price_per_sale: '',
    leftover_weight: '',
    payment_status: 'Crédito',
    notes: ''
  });
  const [selectedReport, setSelectedReport] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('cp_role') === 'admin');
  const [inlineEditing, setInlineEditing] = useState({});
  const [editingData, setEditingData] = useState({});
  const [helpRequestModal, setHelpRequestModal] = useState(false);
  const [helpRequestData, setHelpRequestData] = useState({
    recordId: null,
    issueType: '',
    description: '',
    contactInfo: '',
    urgency: 'normal'
  });
  const [helpRequests, setHelpRequests] = useState([]);

  // Load help requests on component mount
  useEffect(() => {
    const storedRequests = JSON.parse(localStorage.getItem('helpRequests') || '[]');
    setHelpRequests(storedRequests);
  }, []);

  if (selectedReport) return <FoodReport data={selectedReport} onBack={() => { setSelectedReport(null); onUpdate(); }} />;

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

  const handleEditRecord = (record) => {
    setEditingRecord(record);
    const details = record.json_data ? (typeof record.json_data === 'string' ? JSON.parse(record.json_data) : record.json_data) : {};
    
    setExtraData({
      event_name: details.event_name || '',
      batch_purpose: details.batch_purpose || '',
      sale_price: details.sale_price || '',
      leftover_value: details.leftover_value || '',
      unit_price_per_sale: details.unit_price_per_sale || '',
      leftover_weight: details.leftover_weight || '',
      payment_status: details.payment_status || 'Crédito',
      notes: details.notes || ''
    });
    
    setMeats(details.meats || [{ product_id: '', weight: '', cost: '' }]);
    setInputs(details.inputs || [{ description: '', cost: '' }]);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveEdit = () => {
    if (!editingRecord) return;
    
    const enrichedMeats = meats.map(m => {
      const product = products.find(p => p.id === parseInt(m.product_id));
      return {
        ...m,
        name: product ? product.name : 'Producto desconocido'
      };
    });

    const totalMeatCost = meats.reduce((acc, m) => acc + (parseFloat(m.cost) || 0), 0);
    const totalInputCost = inputs.reduce((acc, i) => acc + (parseFloat(i.cost) || 0), 0);
    const totalCost = totalMeatCost + totalInputCost;
    const netBalance = (parseFloat(extraData.sale_price) || 0) - totalCost + (parseFloat(extraData.leftover_value) || 0);

    const data = {
      event_name: extraData.event_name,
      batch_purpose: extraData.batch_purpose,
      payment_status: extraData.payment_status,
      notes: extraData.notes,
      meats: enrichedMeats,
      inputs,
      total_cost: totalCost,
      sale_price: extraData.sale_price,
      leftover_value: extraData.leftover_value,
      unit_price_per_sale: extraData.unit_price_per_sale,
      leftover_weight: extraData.leftover_weight,
      balance: netBalance,
      date: editingRecord.date
    };

    fetch(`${API_BASE}/food-costing/${editingRecord.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gross_weight: meats.reduce((acc, m) => acc + (parseFloat(m.weight) || 0), 0),
        gross_cost: totalCost,
        cooked_weight: netBalance,
        json_data: JSON.stringify(data)
      })
    }).then(res => res.json()).then(() => {
      setEditingRecord(null);
      setMeats([{ product_id: '', weight: '', cost: '' }]);
      setInputs([{ description: '', cost: '' }]);
      setExtraData({ event_name: '', batch_purpose: '', sale_price: '', leftover_value: '', unit_price_per_sale: '', leftover_weight: '', notes: '' });
      onUpdate();
      alert('Registro actualizado exitosamente');
    }).catch(err => {
      console.error('Error updating record:', err);
      alert('Error al actualizar el registro');
    });
  };

  const handleCancelEdit = () => {
    setEditingRecord(null);
    setMeats([{ product_id: '', weight: '', cost: '' }]);
    setInputs([{ description: '', cost: '' }]);
    setExtraData({ event_name: '', batch_purpose: '', sale_price: '', leftover_value: '', unit_price_per_sale: '', leftover_weight: '', notes: '' });
  };

  const handleRequestHelp = (record) => {
    setHelpRequestData({
      recordId: record.id,
      issueType: 'correccion_registro',
      description: '',
      contactInfo: '',
      urgency: 'normal'
    });
    setHelpRequestModal(true);
  };

  const handlePrintPDF = (record) => {
    // Check if user is admin
    const currentRole = sessionStorage.getItem('cp_role');
    if (currentRole !== 'admin') {
      alert('Función de PDF disponible solo para administradores');
      return;
    }

    try {
      console.log('Generating PDF for record:', record);
      
      // Parse record data
      let details = {
        event_name: record.event_name || '---',
        batch_purpose: record.details || '---',
        total_cost: parseFloat(record.gross_cost) || 0,
        sale_price: 0,
        leftover_value: 0,
        unit_price_per_sale: 0,
        leftover_weight: 0,
        balance: parseFloat(record.cooked_weight) || 0
      };
      
      if (record.json_data) {
        const parsed = typeof record.json_data === 'string' ? JSON.parse(record.json_data) : record.json_data;
        details = { ...details, ...parsed };
      }

      // Create PDF content using imported jsPDF
      const doc = new jsPDF();
      
      console.log('PDF document created');
      
      // Add custom font for better Spanish support
      doc.setFont('helvetica');
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(56, 189, 248);
      doc.text('Reporte de Lote de Comida', 105, 20, { align: 'center' });
      
      // Date and ID
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`ID: ${record.id}`, 20, 35);
      doc.text(`Fecha: ${new Date(record.date).toLocaleDateString()}`, 20, 45);
      
      // Main information
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Información General', 20, 65);
      
      doc.setFontSize(11);
      doc.text(`Destino/Institución: ${details.event_name || 'N/A'}`, 20, 80);
      doc.text(`Propósito: ${details.batch_purpose || 'N/A'}`, 20, 90);
      
      // Financial details
      doc.setFontSize(14);
      doc.text('Detalles Financieros', 20, 115);
      
      doc.setFontSize(11);
      doc.text(`Costo Operacional: $${(details.total_cost || 0).toFixed(2)}`, 20, 130);
      doc.text(`Precio Venta: $${parseFloat(details.sale_price || 0).toFixed(2)}`, 20, 140);
      doc.text(`Precio Unitario: $${parseFloat(details.unit_price_per_sale || 0).toFixed(2)}`, 20, 150);
      doc.text(`Peso Restante: ${details.leftover_weight || '0.00'} lbs`, 20, 160);
      doc.text(`Valor Sobrante: $${parseFloat(details.leftover_value || 0).toFixed(2)}`, 20, 170);
      
      // Balance with color
      const balance = parseFloat(details.balance) || 0;
      doc.setTextColor(balance >= 0 ? 16 : 239, balance >= 0 ? 185 : 68, balance >= 0 ? 129 : 68);
      doc.setFontSize(12);
      doc.text(`Utilidad: $${balance.toFixed(2)}`, 20, 185);
      
      // Calculate yield and margin
      const pText = String(details.batch_purpose || '');
      const histWeightMatch = pText.match(/(\d+(\.\d+)?)/);
      const hWeight = histWeightMatch ? parseFloat(histWeightMatch[0]) : (parseFloat(record.cooked_weight) || 0);
      const hRawTotal = (details.meats || []).reduce((acc, m) => acc + (parseFloat(m.weight) || 0), 0) || (parseFloat(record.gross_weight) || 0);
      const hYield = hRawTotal > 0 ? (hWeight / hRawTotal) * 100 : 0;
      const hMargin = details.total_cost > 0 ? (balance / details.total_cost) * 100 : 0;
      
      doc.setTextColor(0);
      doc.setFontSize(11);
      doc.text(`Rendimiento: ${hYield > 0 ? hYield.toFixed(1) + '%' : 'N/A'}`, 20, 200);
      doc.text(`Margen Bruto: ${hMargin.toFixed(1)}%`, 20, 210);
      
      // Cost breakdown
      const totalMeatCost = (details.meats || []).reduce((acc, m) => acc + (parseFloat(m.cost) || 0), 0);
      const totalInputCost = (details.inputs || []).reduce((acc, i) => acc + (parseFloat(i.cost) || 0), 0);
      const unitCost = hWeight > 0 ? (details.total_cost / hWeight) : 0;
      
      doc.setFontSize(14);
      doc.text('Desglose de Costos', 20, 235);
      
      doc.setFontSize(11);
      doc.text(`Materia Prima (Carnes): $${totalMeatCost.toFixed(2)}`, 20, 250);
      doc.text(`Insumos Operativos: $${totalInputCost.toFixed(2)}`, 20, 260);
      doc.text(`Costo Unitario: $${unitCost.toFixed(2)}/lb fina`, 20, 270);
      
      // Meat details if available
      if (details.meats && details.meats.length > 0) {
        doc.addPage();
        doc.setFontSize(14);
        doc.text('Materias Primas (Carnes)', 20, 20);
        
        doc.setFontSize(10);
        let meatY = 35;
        details.meats.forEach((meat, index) => {
          if (meatY > 270) {
            doc.addPage();
            meatY = 20;
          }
          const productName = meat.product_name || meat.name || 'Producto';
          doc.text(`${index + 1}. ${productName}: ${meat.weight || '0'} lbs - $${(meat.cost || '0').toFixed(2)}`, 20, meatY);
          meatY += 10;
        });
      }
      
      // Input details if available
      if (details.inputs && details.inputs.length > 0) {
        doc.addPage();
        doc.setFontSize(14);
        doc.text('Insumos Adicionales', 20, 20);
        
        doc.setFontSize(10);
        let inputY = 35;
        details.inputs.forEach((input, index) => {
          if (inputY > 270) {
            doc.addPage();
            inputY = 20;
          }
          doc.text(`${index + 1}. ${input.description || 'Insumo'}: $${(input.cost || '0').toFixed(2)}`, 20, inputY);
          inputY += 10;
        });
      }
      
      // Notes if available
      if (details.notes && details.notes.trim()) {
        doc.addPage();
        doc.setFontSize(14);
        doc.text('Observaciones y Detalles Finales', 20, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(50);
        const splitNotes = doc.splitTextToSize(details.notes, 170);
        doc.text(splitNotes, 20, 35);
      }
      
      // Footer
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text(`Generado: ${new Date().toLocaleString()}`, 105, 285, { align: 'center' });
      doc.text('Sistema de Inventario y Control de Lotes', 105, 290, { align: 'center' });
      
      // Generate filename and save
      const filename = `Lote_${record.id}_${new Date(record.date).toLocaleDateString().replace(/\//g, '-')}.pdf`;
      console.log('Saving PDF with filename:', filename);
      
      doc.save(filename);
      
      alert('PDF generado exitosamente');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error al generar el PDF: ' + error.message);
    }
  };

  const submitHelpRequest = () => {
    const newRequest = {
      id: Date.now(),
      recordId: helpRequestData.recordId,
      issueType: helpRequestData.issueType,
      description: helpRequestData.description,
      contactInfo: helpRequestData.contactInfo,
      urgency: helpRequestData.urgency,
      timestamp: new Date().toISOString(),
      status: 'pending',
      userRole: sessionStorage.getItem('cp_role') || 'desconocido'
    };

    // Add to help requests list
    setHelpRequests([...helpRequests, newRequest]);

    // Store in localStorage for persistence and admin notification
    const existingRequests = JSON.parse(localStorage.getItem('helpRequests') || '[]');
    existingRequests.push(newRequest);
    localStorage.setItem('helpRequests', JSON.stringify(existingRequests));

    // Show confirmation
    alert(`Solicitud de ayuda enviada exitosamente:\n\n` +
          `ID Registro: ${helpRequestData.recordId}\n` +
          `Tipo: ${helpRequestData.issueType}\n` +
          `Descripción: ${helpRequestData.description}\n` +
          `Urgencia: ${helpRequestData.urgency}\n\n` +
          `El administrador será notificado y responderá a la brevedad.`);

    // Reset modal
    setHelpRequestModal(false);
    setHelpRequestData({
      recordId: null,
      issueType: '',
      description: '',
      contactInfo: '',
      urgency: 'normal'
    });
  };

  const HelpRequestModal = () => {
    if (!helpRequestModal) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          background: 'var(--bg-main)',
          padding: '30px',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto'
        }}>
          <h3 style={{ color: 'var(--accent)', marginBottom: '20px' }}>
            <AlertTriangle size={20} style={{ marginRight: '10px' }} />
            Solicitar Ayuda al Administrador
          </h3>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>
              Tipo de Solicitud:
            </label>
            <select
              value={helpRequestData.issueType}
              onChange={(e) => setHelpRequestData({ ...helpRequestData, issueType: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'white'
              }}
            >
              <option value="">Seleccione un tipo...</option>
              <option value="correccion_registro">Corrección de Registro</option>
              <option value="error_sistema">Error del Sistema</option>
              <option value="acceso_denegado">Acceso Denegado</option>
              <option value="datos_incorrectos">Datos Incorrectos</option>
              <option value="otro">Otro (Especificar)</option>
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>
              ID del Registro:
            </label>
            <input
              type="text"
              value={helpRequestData.recordId || ''}
              readOnly
              style={{
                width: '100%',
                padding: '8px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-muted)'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>
              Descripción Detallada:
            </label>
            <textarea
              value={helpRequestData.description}
              onChange={(e) => setHelpRequestData({ ...helpRequestData, description: e.target.value })}
              placeholder="Describa detalladamente lo que necesita corregir o el problema encontrado..."
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'white',
                minHeight: '100px',
                resize: 'vertical'
              }}
              required
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>
              Información de Contacto:
            </label>
            <input
              type="text"
              value={helpRequestData.contactInfo}
              onChange={(e) => setHelpRequestData({ ...helpRequestData, contactInfo: e.target.value })}
              placeholder="Teléfono, email o forma de contacto preferida"
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'white'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: 'var(--text-main)', display: 'block', marginBottom: '5px' }}>
              Urgencia:
            </label>
            <select
              value={helpRequestData.urgency}
              onChange={(e) => setHelpRequestData({ ...helpRequestData, urgency: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'white'
              }}
            >
              <option value="baja">Baja</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setHelpRequestModal(false)}
              style={{
                padding: '10px 20px',
                background: '#6b7280',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              onClick={submitHelpRequest}
              disabled={!helpRequestData.description || !helpRequestData.issueType}
              style={{
                padding: '10px 20px',
                background: helpRequestData.description && helpRequestData.issueType ? 'var(--accent)' : '#4b5563',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: helpRequestData.description && helpRequestData.issueType ? 'pointer' : 'not-allowed'
              }}
            >
              Enviar Solicitud
            </button>
          </div>
        </div>
      </div>
    );
  };

  const startInlineEdit = (recordId, field, currentValue) => {
    setInlineEditing({ ...inlineEditing, [`${recordId}-${field}`]: true });
    setEditingData({ ...editingData, [`${recordId}-${field}`]: currentValue });
  };

  const saveInlineEdit = (recordId, field) => {
    const newValue = editingData[`${recordId}-${field}`];
    
    // Get the current record
    const record = logs.find(lg => lg.id === recordId);
    if (!record) return;

    // Parse existing data
    let details = {
      event_name: record.event_name || '---',
      batch_purpose: record.details || '---',
      total_cost: parseFloat(record.gross_cost) || 0,
      sale_price: 0,
      leftover_value: 0,
      unit_price_per_sale: 0,
      leftover_weight: 0,
      balance: parseFloat(record.cooked_weight) || 0
    };
    
    try {
      if (record.json_data) {
        const parsed = typeof record.json_data === 'string' ? JSON.parse(record.json_data) : record.json_data;
        details = { ...details, ...parsed };
      }
    } catch (e) { }

    // Clean and convert the value based on field type
    let cleanValue = newValue;
    if (field === 'total_cost' || field === 'sale_price' || field === 'leftover_value' || field === 'unit_price_per_sale') {
      cleanValue = parseFloat(newValue.replace('$', '')) || 0;
    } else if (field === 'leftover_weight') {
      cleanValue = parseFloat(newValue) || 0;
    }

    // Update the specific field
    details[field] = cleanValue;

    // Automatic calculations
    if (field === 'leftover_weight' || field === 'unit_price_per_sale') {
      const weight = parseFloat(details.leftover_weight) || 0;
      const unitPrice = parseFloat(details.unit_price_per_sale) || 0;
      details.leftover_value = (weight * unitPrice).toFixed(2);
    }

    // Recalculate balance if sale_price, leftover_value, or total_cost changed
    if (field === 'sale_price' || field === 'leftover_value' || field === 'total_cost') {
      const totalCost = parseFloat(details.total_cost) || 0;
      const salePrice = parseFloat(details.sale_price) || 0;
      const leftoverValue = parseFloat(details.leftover_value) || 0;
      details.balance = (salePrice - totalCost + leftoverValue).toFixed(2);
    }

    // Update the record
    fetch(`${API_BASE}/food-costing/${recordId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gross_weight: record.gross_weight,
        gross_cost: details.total_cost,
        cooked_weight: details.balance,
        json_data: JSON.stringify(details)
      })
    }).then(res => res.json()).then(() => {
      // Clear editing state
      const newEditing = { ...inlineEditing };
      delete newEditing[`${recordId}-${field}`];
      setInlineEditing(newEditing);
      
      const newEditingData = { ...editingData };
      delete newEditingData[`${recordId}-${field}`];
      setEditingData(newEditingData);
      
      onUpdate();
      alert('Campo actualizado exitosamente');
    }).catch(err => {
      console.error('Error updating field:', err);
      alert('Error al actualizar el campo');
    });
  };

  const cancelInlineEdit = (recordId, field) => {
    const newEditing = { ...inlineEditing };
    delete newEditing[`${recordId}-${field}`];
    setInlineEditing(newEditing);
    
    const newEditingData = { ...editingData };
    delete newEditingData[`${recordId}-${field}`];
    setEditingData(newEditingData);
  };

  const EditableCell = ({ recordId, field, value, type = 'text', editable = true }) => {
    const editKey = `${recordId}-${field}`;
    const isEditing = inlineEditing[editKey];
    const editValue = editingData[editKey] || value;

    if (!isAdmin || !editable) {
      return <span>{value}</span>;
    }

    if (isEditing) {
      return (
        <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
          <input
            type={type}
            step={type === 'number' ? '0.01' : undefined}
            value={editValue}
            onChange={(e) => setEditingData({ ...editingData, [editKey]: e.target.value })}
            style={{ 
              width: type === 'number' ? '80px' : '120px', 
              padding: '2px 4px', 
              fontSize: '0.8rem',
              border: '1px solid var(--accent)',
              borderRadius: '4px',
              background: 'rgba(255,255,255,0.1)',
              color: 'white'
            }}
            autoFocus
          />
          <button
            onClick={() => saveInlineEdit(recordId, field)}
            style={{ 
              padding: '2px 6px', 
              fontSize: '0.6rem', 
              background: '#059669', 
              border: 'none', 
              borderRadius: '2px',
              color: 'white',
              cursor: 'pointer'
            }}
            title="Guardar"
          >
            <Save size={10} />
          </button>
          <button
            onClick={() => cancelInlineEdit(recordId, field)}
            style={{ 
              padding: '2px 6px', 
              fontSize: '0.6rem', 
              background: '#ef4444', 
              border: 'none', 
              borderRadius: '2px',
              color: 'white',
              cursor: 'pointer'
            }}
            title="Cancelar"
          >
            <RotateCcw size={10} />
          </button>
        </div>
      );
    }

    return (
      <span 
        onClick={() => editable && startInlineEdit(recordId, field, value)}
        style={{ 
          cursor: editable ? 'pointer' : 'default',
          padding: '2px 4px',
          borderRadius: '4px',
          transition: 'background 0.2s'
        }}
        onMouseEnter={(e) => editable && (e.target.style.background = 'rgba(255,255,255,0.1)')}
        onMouseLeave={(e) => editable && (e.target.style.background = 'transparent')}
        title={editable ? "Clic para editar" : ""}
      >
        {value}
        {editable && <Edit2 size={10} style={{ marginLeft: '4px', opacity: 0.5 }} />}
      </span>
    );
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

    if (editingRecord) {
      handleSaveEdit();
      return;
    }

    const enrichedMeats = meats.map(m => {
      const product = products.find(p => p.id === parseInt(m.product_id));
      return {
        ...m,
        name: product ? product.name : 'Producto desconocido'
      };
    });

    const data = {
      event_name: extraData.event_name,
      batch_purpose: extraData.batch_purpose,
      payment_status: extraData.payment_status,
      notes: extraData.notes,
      meats: enrichedMeats,
      inputs,
      total_cost: totalCost,
      sale_price: extraData.sale_price,
      leftover_value: extraData.leftover_value,
      unit_price_per_sale: extraData.unit_price_per_sale,
      leftover_weight: extraData.leftover_weight,
      balance: netBalance,
      date: new Date().toISOString()
    };

    // We send it as a unified 'batch' to the food-costing endpoint
    console.log('Saving food costing data:', {
      product_id: meats[0]?.product_id || 0,
      gross_weight: meats.reduce((acc, m) => acc + (parseFloat(m.weight) || 0), 0),
      gross_cost: totalCost,
      cooked_weight: netBalance,
      data_summary: { event_name: data.event_name, batch_purpose: data.batch_purpose }
    });
    
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
    }).then(res => {
      console.log('Server response status:', res.status);
      if (!res.ok) throw new Error('Server returned ' + res.status);
      return res.json();
    }).then(saved => {
      console.log('Data saved successfully:', saved);
      setMeats([{ product_id: '', weight: '', cost: '' }]);
      setInputs([{ description: '', cost: '' }]);
      setExtraData({ event_name: '', batch_purpose: '', sale_price: '', leftover_value: '', unit_price_per_sale: '', leftover_weight: '', notes: '' });
      
      // Force refresh to update the history table immediately
      console.log('Calling onUpdate to refresh data...');
      onUpdate();
      
      // Simple success message with ID validation
      const savedId = saved?.id || 'N/A';
      alert(`¡Lote guardado exitosamente! ID: ${savedId}`);
      
      // Scroll to history section to see the saved data
      setTimeout(() => {
        const historySection = document.querySelector('.form-card:last-of-type');
        if (historySection) {
          historySection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    }).catch(err => {
      console.error('Error saving food costing:', err);
      alert('Error al guardar contabilidad de lote: ' + err.message);
    });
  };

  if (selectedReport) return <FoodReport data={selectedReport} products={products} onBack={() => { setSelectedReport(null); onUpdate(); }} />;

  const handleClearHistory = async () => {
    try {
      await fetch(`${API_BASE}/food-costing-all`, { method: 'DELETE' });
      onUpdate();
    } catch (e) {
      console.error("Error al eliminar historial.", e);
    }
  };

  const handleDeleteRow = async (id) => {
    try {
      await fetch(`${API_BASE}/food-costing/${id}`, { method: 'DELETE' });
      onUpdate();
    } catch (e) {
      console.error("Error al eliminar registro.", e);
    }
  };

  return (
    <div className="report-content">
      {/* Help Requests Notification for Admins */}
      {isAdmin && helpRequests.length > 0 && (
        <div style={{ 
          background: 'rgba(251, 191, 36, 0.1)', 
          border: '1px solid #fbbf24', 
          borderRadius: '8px', 
          padding: '10px', 
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertTriangle size={16} color="#fbbf24" />
          <span style={{ color: '#fbbf24', fontSize: '0.9rem' }}>
            <strong>{helpRequests.filter(r => r.status === 'pending').length}</strong> solicitudes de ayuda pendientes
          </span>
          <button 
            onClick={() => {
              const pendingRequests = helpRequests.filter(r => r.status === 'pending');
              const message = pendingRequests.map(r => 
                `ID: ${r.id} | Registro: ${r.recordId} | Tipo: ${r.issueType} | Urgencia: ${r.urgency}\nDescripción: ${r.description}`
              ).join('\n\n');
              alert(`Solicitudes de Ayuda Pendientes:\n\n${message}`);
            }}
            style={{
              background: '#fbbf24',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              color: 'white',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            Ver Solicitudes
          </button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px', gap: '10px' }}>
        <button onClick={handleClearHistory} className="btn-primary" style={{ width: 'auto', background: '#ef4444', fontSize: '0.8rem', padding: '8px 15px', color: 'white' }}>
          <Trash2 size={16} /> Vaciar Historial
        </button>
      </div>
      <div className="card-grid">
        <form onSubmit={handleSubmit} className="form-card" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Utensils size={24} color={editingRecord ? '#059669' : 'var(--accent)'} /> 
              {editingRecord ? 'Editando Lote / Evento' : 'Calculadora de Lotes / Eventos'}
            </h3>
            {editingRecord && (
              <span style={{ background: 'rgba(5, 150, 105, 0.1)', color: '#059669', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                MODO EDICIÓN - ID: {editingRecord.id}
              </span>
            )}
          </div>

          <div className="form-row two-col">
            <div className="form-group">
              <label>Destino de Venta (Cliente/Institución)</label>
              <input
                type="text"
                value={extraData.event_name}
                onChange={e => setExtraData({ ...extraData, event_name: e.target.value })}
                placeholder="Ej: MAG, CNR, Relaciones Exteriores..."
                required
              />
            </div>
            <div className="form-group">
              <label>Cantidad Producida y Propósito del Lote</label>
              <input
                type="text"
                value={extraData.batch_purpose}
                onChange={e => setExtraData({ ...extraData, batch_purpose: e.target.value })}
                placeholder="Ej: 10 libras para tacos..."
                required
              />
            </div>
          </div>

          <div className="grid-food-sections">
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

            <div className="form-row">
              <div className="form-group">
                <label>Precio Venta / Crédito ($)</label>
                <input type="number" step="0.01" value={extraData.sale_price} onChange={e => setExtraData({ ...extraData, sale_price: e.target.value })} placeholder="0.00" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent)' }} />
              </div>
              <div className="form-group">
                <label>Precio Unitario por Venta ($)</label>
                <input type="number" step="0.01" value={extraData.unit_price_per_sale} onChange={e => setExtraData({ ...extraData, unit_price_per_sale: e.target.value })} placeholder="0.00" style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Peso Restante (lbs)</label>
                <input type="number" step="0.01" value={extraData.leftover_weight} onChange={e => {
                  const newWeight = e.target.value;
                  const unitPrice = parseFloat(extraData.unit_price_per_sale) || 0;
                  const calculatedValue = newWeight && unitPrice ? (parseFloat(newWeight) * unitPrice).toFixed(2) : '';
                  setExtraData({ 
                    ...extraData, 
                    leftover_weight: newWeight,
                    leftover_value: calculatedValue
                  });
                }} placeholder="Ej: 2.10" style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }} />
              </div>
              <div className="form-group">
                <label>Valor de comida que sobró ($)</label>
                <input type="number" step="0.01" value={extraData.leftover_value} onChange={e => setExtraData({ ...extraData, leftover_value: e.target.value })} placeholder="0.00" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }} />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                  Calculado automáticamente: {extraData.leftover_weight} lbs × ${extraData.unit_price_per_sale || '0.00'} = ${extraData.leftover_value || '0.00'}
                </small>
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

            <div className="grid-food-summary">
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
              onChange={e => setExtraData({ ...extraData, notes: e.target.value })}
              placeholder="Escribe aquí cualquier detalle adicional, variaciones en costos o notas sobre la entrega..."
              style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '15px', color: 'white', minHeight: '80px', resize: 'vertical', marginTop: '8px' }}
            />
          </div>

          <div style={{ marginTop: '25px', display: 'flex', gap: '10px' }}>
            {editingRecord && (
              <button 
                type="button" 
                onClick={handleCancelEdit}
                className="btn-primary" 
                style={{ padding: '18px', fontSize: '1rem', background: '#ef4444', flex: 1 }}
              >
                Cancelar Edición
              </button>
            )}
            <button 
              type="submit" 
              className="btn-primary" 
              style={{ padding: '18px', fontSize: '1rem', background: editingRecord ? '#059669' : 'linear-gradient(to right, var(--accent), var(--secondary))', flex: editingRecord ? 2 : 1 }}
            >
              {editingRecord ? 'Guardar Cambios' : 'Finalizar y Guardar Contabilidad de Lote'}
            </button>
          </div>
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
                <th>Precio Unitario ($)</th>
                <th>Peso Restante (lbs)</th>
                <th>Valor Sobrante ($)</th>
                <th>Rend. %</th>
                <th>Utilidad ($)</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Sin registros de lotes</td></tr>
              ) : (
                logs.slice().reverse().map(lg => {
                  let details = {
                    event_name: lg.event_name || '—',
                    batch_purpose: lg.details || '—',
                    total_cost: parseFloat(lg.gross_cost) || 0,
                    sale_price: 0,
                    leftover_value: 0,
                    balance: parseFloat(lg.cooked_weight) || 0
                  };
                  try {
                    if (lg.json_data) {
                      const parsed = typeof lg.json_data === 'string' ? JSON.parse(lg.json_data) : lg.json_data;
                      details = { ...details, ...parsed };
                    }
                  } catch (e) { }

                  const pText = String(details.batch_purpose || '');
                  const histWeightMatch = pText.match(/(\d+(\.\d+)?)/);
                  const hWeight = histWeightMatch ? parseFloat(histWeightMatch[0]) : (parseFloat(lg.cooked_weight) || 0);
                  const hRawTotal = (details.meats || []).reduce((acc, m) => acc + (parseFloat(m.weight) || 0), 0) || (parseFloat(lg.gross_weight) || 0);
                  const hYield = hRawTotal > 0 ? (hWeight / hRawTotal) * 100 : 0;
                  const balance = parseFloat(details.balance) || 0;

                  return (
                    <tr key={lg.id} className="fade-in">
                      <td style={{ color: 'var(--text-muted)' }}>
                        <EditableCell 
                          recordId={lg.id} 
                          field="date" 
                          value={new Date(lg.date).toLocaleDateString()} 
                          editable={false}
                        />
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--accent)' }}>
                        <EditableCell 
                          recordId={lg.id} 
                          field="batch_purpose" 
                          value={details.batch_purpose || '---'} 
                        />
                      </td>
                      <td style={{ fontWeight: 800 }}>
                        <EditableCell 
                          recordId={lg.id} 
                          field="event_name" 
                          value={details.event_name || '---'} 
                        />
                      </td>
                      <td>
                        <EditableCell 
                          recordId={lg.id} 
                          field="total_cost" 
                          value={`$${(details.total_cost || 0).toFixed(2)}`} 
                          type="number"
                        />
                      </td>
                      <td style={{ color: 'var(--accent)' }}>
                        <EditableCell 
                          recordId={lg.id} 
                          field="sale_price" 
                          value={`$${parseFloat(details.sale_price || 0).toFixed(2)}`} 
                          type="number"
                        />
                      </td>
                      <td>
                        <EditableCell 
                          recordId={lg.id} 
                          field="unit_price_per_sale" 
                          value={`$${parseFloat(details.unit_price_per_sale || 0).toFixed(2)}`} 
                          type="number"
                        />
                      </td>
                      <td>
                        <EditableCell 
                          recordId={lg.id} 
                          field="leftover_weight" 
                          value={details.leftover_weight || '0.00'} 
                          type="number"
                        />
                      </td>
                      <td style={{ color: 'var(--success)' }}>
                        <EditableCell 
                          recordId={lg.id} 
                          field="leftover_value" 
                          value={`$${parseFloat(details.leftover_value || 0).toFixed(2)}`} 
                          type="number"
                        />
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {hYield > 0 ? hYield.toFixed(0) + '%' : '---'}
                      </td>
                      <td style={{
                        fontWeight: 900,
                        color: balance >= 0 ? 'var(--success)' : '#ef4444',
                        background: balance >= 0 ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)'
                      }}>
                        <EditableCell 
                          recordId={lg.id} 
                          field="balance" 
                          value={`$${balance.toFixed(2)}`} 
                          type="number"
                          editable={false}
                        />
                      </td>
                      <td className="col-actions">
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <motion.button
                            whileHover={{ scale: 1.2 }}
                            onClick={() => { setSelectedReport(lg); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}
                            title="Ver Reporte"
                          >
                            <FileText size={14} />
                          </motion.button>
                          {isAdmin && (
                            <motion.button
                              whileHover={{ scale: 1.2 }}
                              onClick={() => handlePrintPDF(lg)}
                              style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }}
                              title="Imprimir PDF"
                            >
                              <Download size={14} />
                            </motion.button>
                          )}
                          {isAdmin ? (
                            <motion.button
                              whileHover={{ scale: 1.2 }}
                              onClick={() => handleEditRecord(lg)}
                              style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer' }}
                              title="Editar Registro"
                            >
                              <Edit2 size={14} />
                            </motion.button>
                          ) : (
                            <motion.button
                              whileHover={{ scale: 1.2 }}
                              onClick={() => handleRequestHelp(lg)}
                              style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer' }}
                              title="Solicitar Ayuda"
                            >
                              <AlertTriangle size={14} />
                            </motion.button>
                          )}
                          {isAdmin && (
                            <motion.button
                              whileHover={{ scale: 1.2 }}
                              onClick={() => {
                                if (confirm('¿Eliminar este registro de lote?')) {
                                  handleDeleteRow(lg.id);
                                }
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                              title="Eliminar Registro"
                            >
                              <Trash2 size={14} />
                            </motion.button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Help Request Modal */}
      <HelpRequestModal />
    </div>
  );
};

// --- AdminMonitor Component ---
const ACTION_COLORS = {
  'RECEPCIÓN':   { bg: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.35)',  text: '#38bdf8'  },
  'DESPACHO':    { bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)', text: '#a78bfa'  },
  'PRODUCCIÓN':  { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.35)',  text: '#fbbf24'  },
  'AJUSTE STOCK':{ bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)',  text: '#10b981'  },
  'LOTE COMIDA': { bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.35)', text: '#f472b6'  },
};

const ROLE_LABELS = {
  admin: 'Administrador',
  soyapango_puesto: 'Soyapango — Puesto',
  soyapango_bodega: 'Soyapango — Bodega',
  usulutan_puesto: 'Usulután — Puesto',
  usulutan_bodega: 'Usulután — Bodega',
  agro_quezaltepeque: 'Agro Quezaltepeque',
  agro_aguilares: 'Agro Aguilares',
  agro_opico: 'Agro Opico',
  lomas_ventas: 'Lomas — Ventas',
  lomas_bodega: 'Lomas — Bodega',
};

const AdminMonitor = () => {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [newCount, setNewCount] = useState(0);
  const [lastSeen, setLastSeen] = useState(0);

  const fetchLogs = async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/activity`);
      const data = await r.json();
      if (Array.isArray(data)) {
        setLogs(data);
        // Contar nuevos desde la última vez que se vio
        const newOnes = data.filter(l => l.id > lastSeen).length;
        if (newOnes > 0 && lastSeen > 0) setNewCount(prev => prev + newOnes);
      }
    } catch(e) {}
  };

  useEffect(() => {
    fetchLogs();
    const iv = setInterval(fetchLogs, 8000);
    return () => clearInterval(iv);
  }, []);

  const handleClear = async () => {
    if (!confirm('¿Limpiar todo el historial de actividad?')) return;
    await fetch(`${API_BASE}/admin/activity`, { method: 'DELETE' });
    setLogs([]); setNewCount(0);
  };

  const markSeen = () => {
    if (logs.length > 0) setLastSeen(logs[0].id);
    setNewCount(0);
  };

  const filtered = filter === 'all' ? logs : logs.filter(l => l.action === filter || l.role === filter);
  const actions = [...new Set(logs.map(l => l.action))];
  const roles = [...new Set(logs.map(l => l.role))];

  const formatTime = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('es-SV', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="report-content">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={22} color="var(--accent)" />
            Monitor de Actividad
            {newCount > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 900 }}>
                +{newCount} nuevos
              </span>
            )}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '4px 0 0 0' }}>
            Todos los movimientos registrados en tiempo real — {logs.length} eventos
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => { fetchLogs(); markSeen(); }} className="btn-primary"
            style={{ width: 'auto', padding: '8px 16px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCcw size={14} /> Actualizar
          </button>
          <button onClick={handleClear} className="btn-primary"
            style={{ width: 'auto', padding: '8px 16px', fontSize: '0.78rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', boxShadow: 'none' }}>
            <Trash2 size={14} /> Limpiar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <button onClick={() => setFilter('all')} style={{ padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, background: filter === 'all' ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: filter === 'all' ? '#020617' : 'var(--text-muted)' }}>
          Todos
        </button>
        {actions.map(a => {
          const c = ACTION_COLORS[a] || { bg: 'rgba(255,255,255,0.06)', border: 'transparent', text: 'var(--text-muted)' };
          return (
            <button key={a} onClick={() => setFilter(a)} style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${filter === a ? c.border : 'transparent'}`, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, background: filter === a ? c.bg : 'rgba(255,255,255,0.04)', color: filter === a ? c.text : 'var(--text-muted)' }}>
              {a}
            </button>
          );
        })}
        <div style={{ width: '1px', background: 'var(--border-light)', margin: '0 4px' }} />
        {roles.map(r => (
          <button key={r} onClick={() => setFilter(r)} style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${filter === r ? 'rgba(167,139,250,0.4)' : 'transparent'}`, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, background: filter === r ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.04)', color: filter === r ? '#a78bfa' : 'var(--text-muted)' }}>
            {ROLE_LABELS[r] || r}
          </button>
        ))}
      </div>

      {/* Lista de eventos */}
      {filtered.length === 0 ? (
        <div className="form-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <Activity size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <p>Sin actividad registrada aún.</p>
          <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>Los movimientos aparecerán aquí en tiempo real.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(log => {
            const c = ACTION_COLORS[log.action] || { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: 'var(--text-muted)' };
            return (
              <div key={log.id} style={{ background: 'var(--glass-surface)', border: `1px solid var(--border-light)`, borderLeft: `3px solid ${c.text}`, borderRadius: '14px', padding: '14px 18px', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '14px', alignItems: 'center' }}>
                {/* Badge acción */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '80px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '8px', background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontSize: '0.65rem', fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    {log.action}
                  </span>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    {ROLE_LABELS[log.role] || log.role}
                  </span>
                </div>

                {/* Contenido */}
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '3px' }}>
                    {log.product_name || '—'}
                    {log.quantity && <span style={{ color: c.text, marginLeft: '8px', fontWeight: 900 }}>{parseFloat(log.quantity).toFixed(1)} {log.unit}</span>}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {log.location && <span style={{ marginRight: '10px' }}>📍 {log.location}</span>}
                    {log.details && <span>{log.details}</span>}
                  </div>
                </div>

                {/* Timestamp */}
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {formatTime(log.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}
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
    <div className="process-stepper" style={{ display: 'flex', justifyContent: 'center', marginBottom: '3rem', gap: '15px' }}>
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
  // ── Sesión ──────────────────────────────────────────────────────────────────
  const [currentRole, setCurrentRole] = useState(() => sessionStorage.getItem('cp_role') || null);

  const handleLogin = (role) => setCurrentRole(role);
  const handleLogout = () => { sessionStorage.removeItem('cp_role'); setCurrentRole(null); };

  if (!currentRole) return <LoginScreen onLogin={handleLogin} />;

  const roleCfg = ROLES[currentRole];

  return <AppShell role={currentRole} roleCfg={roleCfg} onLogout={handleLogout} />;
};

// ─── APP SHELL (contenido principal) ─────────────────────────────────────────
const AppShell = ({ role, roleCfg, onLogout }) => {
  const [publicUrl, setPublicUrl] = useState(null);
  useEffect(() => {
    fetch('/api/public-url').then(r => r.json()).then(d => setPublicUrl(d?.url ?? null)).catch(() => setPublicUrl(null));
  }, []);
  const [activeTab, setActiveTab] = useState(roleCfg.defaultTab);
  const [products, setProducts] = useState([]);
  const [agros, setAgros] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const [productionLogs, setProductionLogs] = useState([]);
  const [incomeLogs, setIncomeLogs] = useState([]);
  const [dispatchLogs, setDispatchLogs] = useState([]);
  const [inventorySummary, setInventorySummary] = useState([]);
  const [foodCostingLogs, setFoodCostingLogs] = useState([]);

  // Solo navegar a tabs permitidas
  const safeSetTab = (tab) => {
    if (roleCfg.tabs.includes(tab)) setActiveTab(tab);
  };

  useEffect(() => {
    const handleTabChange = (e) => safeSetTab(e.detail);
    window.addEventListener('changeTab', handleTabChange);
    return () => window.removeEventListener('changeTab', handleTabChange);
  }, []);

  useEffect(() => {
    const fetchData = () => {
      fetch(`${API_BASE}/products`)
        .then(r => r.json())
        .then(d => setProducts(Array.isArray(d) ? d : []))
        .catch(() => setProducts([]));
      fetch(`${API_BASE}/agros`)
        .then(r => r.json())
        .then(d => setAgros(Array.isArray(d) ? d : []))
        .catch(() => setAgros([]));
      fetch(`${API_BASE}/production/logs`)
        .then(r => r.json())
        .then(d => setProductionLogs(Array.isArray(d) ? d : []))
        .catch(() => setProductionLogs([]));
      fetch(`${API_BASE}/reports/dispatches`)
        .then(r => r.json())
        .then(d => setDispatchLogs(Array.isArray(d) ? d : []))
        .catch(() => setDispatchLogs([]));
      fetch(`${API_BASE}/reports/ransa`)
        .then(r => r.json())
        .then(d => setIncomeLogs(Array.isArray(d) ? d : []))
        .catch(() => setIncomeLogs([]));
      fetch(`${API_BASE}/reports/inventory-status`)
        .then(r => r.json())
        .then(d => setInventorySummary(Array.isArray(d) ? d : []))
        .catch(() => setInventorySummary([]));
      fetch(`${API_BASE}/food-costing`)
        .then(r => r.json())
        .then(d => {
          console.log('Food costing logs fetched:', d);
          setFoodCostingLogs(Array.isArray(d) ? d : []);
        })
        .catch(() => setFoodCostingLogs([]));
    };
    fetchData();
    const inv = setInterval(fetchData, 8000);
    return () => clearInterval(inv);
  }, [refresh]);

  // Auto-refresh on version change
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const response = await fetch(`${API_BASE}/version`);
        if (response.ok) {
          const serverVersion = await response.text();
          const localVersion = localStorage.getItem('app_version') || 'v1.0.0';
          
          if (serverVersion !== localVersion) {
            localStorage.setItem('app_version', serverVersion);
            alert('✅ Aplicación actualizada exitosamente. Recargando...');
            window.location.reload();
          }
        }
      } catch (e) {
        // Version check failed, ignore
      }
    };

    checkForUpdates();
    updateCheckInterval = setInterval(checkForUpdates, 30000); // Check every 30 seconds

    return () => {
      if (updateCheckInterval) clearInterval(updateCheckInterval);
    };
  }, []);

  const triggerRefresh = () => setRefresh(prev => prev + 1);

  // Definición de todas las tabs disponibles
  const allTabs = [
    { id: 'income',       label: 'Recepción',  icon: <Store size={18} /> },
    { id: 'production',   label: 'Procesos',   icon: <Cpu size={18} /> },
    { id: 'distribution', label: 'Despacho',   icon: <Truck size={18} /> },
    { id: 'invoice',      label: 'Factura',    icon: <FileText size={18} /> },
    { id: 'status',       label: 'Stock',      icon: <BarChart3 size={18} /> },
    { id: 'reports',      label: 'Export',     icon: <DownloadCloud size={18} /> },
    { id: 'comida',       label: 'Comida',     icon: <Utensils size={18} /> },
    { id: 'monitor',      label: 'Monitor',    icon: <Activity size={18} /> },
    { id: 'config',       label: 'Admin',      icon: <ShieldCheck size={18} /> },
  ];
  const visibleTabs = allTabs.filter(t => roleCfg.tabs.includes(t.id));

  return (
    <div className="app-container">
      <header>
        <div className="subtitle">Carnes del Paraguay</div>
        <h1>Logística & Control de Inventario</h1>
        {/* Badge de sesión */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '12px' }}>
          <div style={{ padding: '5px 14px', borderRadius: '20px', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.25)', fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '1px', textTransform: 'uppercase' }}>
            {roleCfg.label}
          </div>
          <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <LogOut size={12} /> Salir
          </button>
        </div>
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
              <div className="status-value">{Math.round(val).toLocaleString()} <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{w.label === 'Ransa' ? 'KG' : 'LBS'}</span></div>
            </div>
          );
        })}

        <div className="status-item global">
          <div className="status-label">EXISTENCIA GLOBAL</div>
          <div className="status-value">
            {Math.round(inventorySummary.reduce((acc, i) => acc + (parseFloat(i.final_stock) || 0), 0)).toLocaleString()} <small style={{ fontSize: '0.6rem' }}>LBS</small>
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
        {visibleTabs.map(t => (
          <button key={t.id} className={activeTab === t.id ? 'active' : ''} onClick={() => safeSetTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
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
            <TabErrorBoundary resetKey={activeTab} onRetry={triggerRefresh}>
              {activeTab === 'income' && <LogisticsHub products={products} agros={agros} refreshTrigger={refresh} onUpdate={triggerRefresh} forceMode="unified" incomeLogs={incomeLogs} dispatchLogs={dispatchLogs} />}
              {activeTab === 'production' && <ProductionReport products={products} onUpdate={triggerRefresh} productionLogs={productionLogs} />}
              {activeTab === 'distribution' && <LogisticsHub products={products} agros={agros} refreshTrigger={refresh} onUpdate={triggerRefresh} forceMode="distribution" incomeLogs={incomeLogs} dispatchLogs={dispatchLogs} />}
              {activeTab === 'invoice' && <InvoicingSystem products={products} agros={agros} onUpdate={triggerRefresh} />}
              {activeTab === 'status' && <StatusReport products={products} refreshTrigger={refresh} onUpdate={triggerRefresh} />}
              {activeTab === 'reports' && <ExportReport products={products} agros={agros} refreshTrigger={refresh} />}
              {activeTab === 'comida' && <FoodCostingSystem products={products} onUpdate={triggerRefresh} logs={foodCostingLogs} />}
              {activeTab === 'monitor' && <AdminMonitor />}
              {activeTab === 'config' && <ConfigPanel products={products} onUpdate={triggerRefresh} />}
            </TabErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>

      <footer>
        <p>&copy; 2026 Carnes del Paraguay - Sistema de Logística Propio</p>
      </footer>
    </div>
  );
};

export default App;
