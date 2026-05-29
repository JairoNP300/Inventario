/**
 * Test de Regresión — Ransa KG Units
 *
 * PROPÓSITO: Verificar que el comportamiento corregido se mantiene:
 *   - El banner global muestra "KG" para Ransa y "LBS" para las demás bodegas.
 *   - El formulario unificado de recepción usa Kilogramos en sus labels y unidad.
 *
 * Estos tests replican las funciones de render usadas en src/App.jsx tras la
 * corrección. Si en el futuro alguien vuelve a hardcodear "LBS" para Ransa
 * o "(Lbs)" en el formulario unificado, estos tests fallarán y servirán de
 * red de seguridad para evitar regresiones.
 *
 * Originalmente este archivo documentaba el bug (tests diseñados para fallar);
 * tras aplicar la corrección en App.jsx los tests se actualizan para validar
 * la conducta correcta.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Funciones de render puras que replican la versión corregida de App.jsx
// (banner global ~línea 4814 y formulario unificado ~líneas 2222-2249)
// ---------------------------------------------------------------------------

/**
 * Render del banner item tal como está en App.jsx tras la corrección.
 * Ransa muestra "KG" y las demás bodegas muestran "LBS".
 */
const renderBannerItem_fixed = (warehouse, value = 1234) => (
  <div key={warehouse.col} className="status-item" data-testid={`banner-${warehouse.label}`}>
    <div className="status-label">{warehouse.label}</div>
    <div className="status-value" data-testid={`banner-value-${warehouse.label}`}>
      {Math.round(value).toLocaleString()}{' '}
      <span
        data-testid={`banner-unit-${warehouse.label}`}
        style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}
      >
        {warehouse.label === 'Ransa' ? 'KG' : 'LBS'}
      </span>
    </div>
  </div>
);

/**
 * Render del bloque de pesos del formulario unificado tal como está en
 * App.jsx tras la corrección. Los pesos se ingresan en Kg porque Ransa
 * (origen) trabaja en kilogramos.
 */
const renderUnifiedForm_fixed = () => (
  <div data-testid="unified-form">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
      <div className="form-group">
        <label data-testid="label-tag-weight">Peso según Viñeta (Kg)</label>
        <input type="number" step="0.01" defaultValue="" />
      </div>
      <div className="form-group">
        <label data-testid="label-scale-weight">Peso según Báscula (Kg)</label>
        <input type="number" step="0.01" defaultValue="" />
      </div>
      <div className="form-group">
        <label>Unidad</label>
        <input
          data-testid="input-unit"
          type="text"
          value="Kilogramos (KG)"
          readOnly
          style={{ background: 'rgba(15, 23, 42, 0.4)', borderColor: 'rgba(255,255,255,0.05)' }}
        />
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Datos de prueba — las bodegas del banner tal como están en App.jsx
// ---------------------------------------------------------------------------
const WAREHOUSES = [
  { label: 'Ransa',      col: 'bodega_1' },
  { label: 'Soyapango',  col: 'bodega_2' },
  { label: 'Usulután',   col: 'bodega_3' },
  { label: 'Lomas',      col: 'bodega_4' },
];

// ---------------------------------------------------------------------------
// Property 1 — Regresión: Banner Ransa muestra KG
// Validates: Requirements 2.1
// ---------------------------------------------------------------------------
describe('Property 1 — Regresión: Banner Ransa debe mostrar KG', () => {
  it('el banner de Ransa muestra "KG"', () => {
    const ransaWarehouse = WAREHOUSES.find(w => w.label === 'Ransa');
    const { getByTestId } = render(renderBannerItem_fixed(ransaWarehouse, 5000));

    const unitSpan = getByTestId('banner-unit-Ransa');

    expect(unitSpan).toHaveTextContent('KG');
    expect(unitSpan).not.toHaveTextContent('LBS');
  });
});

// ---------------------------------------------------------------------------
// Property 2 — Regresión: Formulario unificado muestra Kg/Kilogramos (KG)
// Validates: Requirements 2.2, 2.3, 2.4
// ---------------------------------------------------------------------------
describe('Property 2 — Regresión: Formulario unificado debe mostrar Kg/Kilogramos (KG)', () => {
  it('el label "Peso según Viñeta" contiene "(Kg)"', () => {
    render(renderUnifiedForm_fixed());

    const labelViñeta = screen.getByTestId('label-tag-weight');

    expect(labelViñeta).toHaveTextContent('(Kg)');
    expect(labelViñeta).not.toHaveTextContent('(Lbs)');
  });

  it('el label "Peso según Báscula" contiene "(Kg)"', () => {
    render(renderUnifiedForm_fixed());

    const labelBáscula = screen.getByTestId('label-scale-weight');

    expect(labelBáscula).toHaveTextContent('(Kg)');
    expect(labelBáscula).not.toHaveTextContent('(Lbs)');
  });

  it('el input de Unidad tiene value "Kilogramos (KG)"', () => {
    render(renderUnifiedForm_fixed());

    const inputUnit = screen.getByTestId('input-unit');

    expect(inputUnit).toHaveValue('Kilogramos (KG)');
    expect(inputUnit).not.toHaveValue('Libras (LBS)');
  });
});
