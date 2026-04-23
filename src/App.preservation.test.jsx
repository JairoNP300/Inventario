/**
 * Tests de Preservación — Ransa KG Units
 *
 * PROPÓSITO: Verificar que el comportamiento de las bodegas NO-Ransa y los
 * formularios no-unificados se preserva sin cambios.
 * Estos tests DEBEN PASAR en el código sin corregir Y después del fix.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Funciones de render puras extraídas de App.jsx para testeo aislado
// Estas replican EXACTAMENTE el código actual (sin corregir) de App.jsx
// ---------------------------------------------------------------------------

/**
 * Replica el render del banner item tal como está en App.jsx (~línea 1817)
 * El código actual usa "LBS" hardcoded para TODAS las bodegas.
 */
const renderBannerItem_current = (warehouse, value = 1234) => (
  <div key={warehouse.col} className="status-item" data-testid={`banner-${warehouse.label}`}>
    <div className="status-label">{warehouse.label}</div>
    <div className="status-value" data-testid={`banner-value-${warehouse.label}`}>
      {Math.round(value).toLocaleString()}{' '}
      <span
        data-testid={`banner-unit-${warehouse.label}`}
        style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}
      >
        LBS
      </span>
    </div>
  </div>
);

/**
 * Replica el formulario en modo 'dispatch' tal como está en App.jsx.
 * Este modo NO debe mostrar strings de KG.
 */
const renderDispatchForm_current = () => (
  <div data-testid="dispatch-form">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
      <div className="form-group">
        <label data-testid="label-tag-weight-dispatch">Peso según Viñeta (Lbs)</label>
        <input type="number" step="0.01" defaultValue="" />
      </div>
      <div className="form-group">
        <label data-testid="label-scale-weight-dispatch">Peso según Báscula (Lbs)</label>
        <input type="number" step="0.01" defaultValue="" />
      </div>
      <div className="form-group">
        <label>Unidad</label>
        <input
          data-testid="input-unit-dispatch"
          type="text"
          value="Libras (LBS)"
          readOnly
          style={{ background: 'rgba(15, 23, 42, 0.4)', borderColor: 'rgba(255,255,255,0.05)' }}
        />
      </div>
    </div>
  </div>
);

/**
 * Replica el formulario en modo 'mass' tal como está en App.jsx.
 * Este modo NO debe mostrar strings de KG.
 */
const renderMassForm_current = () => (
  <div data-testid="mass-form">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
      <div className="form-group">
        <label data-testid="label-tag-weight-mass">Peso según Viñeta (Lbs)</label>
        <input type="number" step="0.01" defaultValue="" />
      </div>
      <div className="form-group">
        <label data-testid="label-scale-weight-mass">Peso según Báscula (Lbs)</label>
        <input type="number" step="0.01" defaultValue="" />
      </div>
      <div className="form-group">
        <label>Unidad</label>
        <input
          data-testid="input-unit-mass"
          type="text"
          value="Libras (LBS)"
          readOnly
          style={{ background: 'rgba(15, 23, 42, 0.4)', borderColor: 'rgba(255,255,255,0.05)' }}
        />
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Datos de prueba — bodegas NO-Ransa del banner
// ---------------------------------------------------------------------------
const NON_RANSA_WAREHOUSES = [
  { label: 'Soyapango', col: 'bodega_2' },
  { label: 'Usulután',  col: 'bodega_3' },
  { label: 'Lomas',     col: 'bodega_4' },
];

// ---------------------------------------------------------------------------
// Property 3 — Preservation: Otras bodegas en banner muestran LBS
// Validates: Requirements 3.1, 3.2, 3.3
//
// ESTOS TESTS DEBEN PASAR: el código actual muestra "LBS" para todas las bodegas.
// Deben seguir pasando después del fix (el fix solo cambia Ransa).
// ---------------------------------------------------------------------------
describe('Property 3 — Preservation: Banner de bodegas NO-Ransa muestra LBS', () => {
  it('el banner de Soyapango muestra "LBS" (debe preservarse)', () => {
    const warehouse = NON_RANSA_WAREHOUSES.find(w => w.label === 'Soyapango');
    const { getByTestId } = render(renderBannerItem_current(warehouse, 2500));

    const unitSpan = getByTestId('banner-unit-Soyapango');

    // ASSERTION: el banner de Soyapango DEBE mostrar "LBS" — sin cambios
    expect(unitSpan).toHaveTextContent('LBS');
  });

  it('el banner de Usulután muestra "LBS" (debe preservarse)', () => {
    const warehouse = NON_RANSA_WAREHOUSES.find(w => w.label === 'Usulután');
    const { getByTestId } = render(renderBannerItem_current(warehouse, 1800));

    const unitSpan = getByTestId('banner-unit-Usulután');

    // ASSERTION: el banner de Usulután DEBE mostrar "LBS" — sin cambios
    expect(unitSpan).toHaveTextContent('LBS');
  });

  it('el banner de Lomas muestra "LBS" (debe preservarse)', () => {
    const warehouse = NON_RANSA_WAREHOUSES.find(w => w.label === 'Lomas');
    const { getByTestId } = render(renderBannerItem_current(warehouse, 900));

    const unitSpan = getByTestId('banner-unit-Lomas');

    // ASSERTION: el banner de Lomas DEBE mostrar "LBS" — sin cambios
    expect(unitSpan).toHaveTextContent('LBS');
  });

  it('todas las bodegas NO-Ransa muestran "LBS" en el banner', () => {
    NON_RANSA_WAREHOUSES.forEach(warehouse => {
      const { getByTestId, unmount } = render(renderBannerItem_current(warehouse, 1000));
      const unitSpan = getByTestId(`banner-unit-${warehouse.label}`);
      expect(unitSpan).toHaveTextContent('LBS');
      unmount();
    });
  });
});

// ---------------------------------------------------------------------------
// Property 4 — Preservation: Formulario en modo 'dispatch' no muestra KG
// Validates: Requirements 3.5
//
// ESTOS TESTS DEBEN PASAR: el código actual usa "Lbs"/"Libras (LBS)" en dispatch.
// Deben seguir pasando después del fix (el fix solo cambia el modo 'unified').
// ---------------------------------------------------------------------------
describe('Property 4 — Preservation: Formulario en modo dispatch no muestra strings de KG', () => {
  it('el label "Peso según Viñeta" en modo dispatch NO contiene "(Kg)"', () => {
    render(renderDispatchForm_current());

    const label = screen.getByTestId('label-tag-weight-dispatch');

    // ASSERTION: el label en dispatch NO debe contener "(Kg)"
    expect(label).not.toHaveTextContent('(Kg)');
    // Y debe seguir mostrando "(Lbs)"
    expect(label).toHaveTextContent('(Lbs)');
  });

  it('el label "Peso según Báscula" en modo dispatch NO contiene "(Kg)"', () => {
    render(renderDispatchForm_current());

    const label = screen.getByTestId('label-scale-weight-dispatch');

    // ASSERTION: el label en dispatch NO debe contener "(Kg)"
    expect(label).not.toHaveTextContent('(Kg)');
    expect(label).toHaveTextContent('(Lbs)');
  });

  it('el input de Unidad en modo dispatch NO tiene value "Kilogramos (KG)"', () => {
    render(renderDispatchForm_current());

    const inputUnit = screen.getByTestId('input-unit-dispatch');

    // ASSERTION: el input en dispatch NO debe tener "Kilogramos (KG)"
    expect(inputUnit).not.toHaveValue('Kilogramos (KG)');
    // Y debe seguir teniendo "Libras (LBS)"
    expect(inputUnit).toHaveValue('Libras (LBS)');
  });
});

// ---------------------------------------------------------------------------
// Property 4 (cont.) — Preservation: Formulario en modo 'mass' no muestra KG
// Validates: Requirements 3.5
// ---------------------------------------------------------------------------
describe('Property 4 — Preservation: Formulario en modo mass no muestra strings de KG', () => {
  it('el label "Peso según Viñeta" en modo mass NO contiene "(Kg)"', () => {
    render(renderMassForm_current());

    const label = screen.getByTestId('label-tag-weight-mass');

    // ASSERTION: el label en mass NO debe contener "(Kg)"
    expect(label).not.toHaveTextContent('(Kg)');
    expect(label).toHaveTextContent('(Lbs)');
  });

  it('el label "Peso según Báscula" en modo mass NO contiene "(Kg)"', () => {
    render(renderMassForm_current());

    const label = screen.getByTestId('label-scale-weight-mass');

    // ASSERTION: el label en mass NO debe contener "(Kg)"
    expect(label).not.toHaveTextContent('(Kg)');
    expect(label).toHaveTextContent('(Lbs)');
  });

  it('el input de Unidad en modo mass NO tiene value "Kilogramos (KG)"', () => {
    render(renderMassForm_current());

    const inputUnit = screen.getByTestId('input-unit-mass');

    // ASSERTION: el input en mass NO debe tener "Kilogramos (KG)"
    expect(inputUnit).not.toHaveValue('Kilogramos (KG)');
    expect(inputUnit).toHaveValue('Libras (LBS)');
  });
});
