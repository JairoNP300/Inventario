/**
 * Test de Exploración de Condición de Bug — Ransa KG Units
 *
 * PROPÓSITO: Confirmar que el bug EXISTE en el código sin corregir.
 * Este test DEBE FALLAR — la falla es el resultado esperado y correcto.
 * NO intentar corregir el código hasta que este test esté documentado.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Funciones de render puras extraídas de App.jsx para testeo aislado
// Estas replican EXACTAMENTE el código actual (buggy) de App.jsx
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
 * Replica el bloque del formulario unificado tal como está en App.jsx (~líneas 1075-1090)
 * El código actual usa "(Lbs)" y "Libras (LBS)" hardcoded.
 */
const renderUnifiedForm_current = () => (
  <div data-testid="unified-form">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
      <div className="form-group">
        <label data-testid="label-tag-weight">Peso según Viñeta (Lbs)</label>
        <input type="number" step="0.01" defaultValue="" />
      </div>
      <div className="form-group">
        <label data-testid="label-scale-weight">Peso según Báscula (Lbs)</label>
        <input type="number" step="0.01" defaultValue="" />
      </div>
      <div className="form-group">
        <label>Unidad</label>
        <input
          data-testid="input-unit"
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
// Datos de prueba — las bodegas del banner tal como están en App.jsx
// ---------------------------------------------------------------------------
const WAREHOUSES = [
  { label: 'Ransa',      col: 'bodega_1' },
  { label: 'Soyapango',  col: 'bodega_2' },
  { label: 'Usulután',   col: 'bodega_3' },
  { label: 'Lomas',      col: 'bodega_4' },
];

// ---------------------------------------------------------------------------
// Property 1 — Bug Condition: Banner Ransa muestra KG
// Validates: Requirements 1.1 (current behavior) → 2.1 (expected behavior)
//
// ESTE TEST DEBE FALLAR: el código actual muestra "LBS" para Ransa.
// La falla confirma que el bug existe.
// ---------------------------------------------------------------------------
describe('Property 1 — Bug Condition: Banner Ransa debe mostrar KG', () => {
  it('el banner de Ransa muestra "KG" (FALLA ESPERADA: actualmente muestra "LBS")', () => {
    const ransaWarehouse = WAREHOUSES.find(w => w.label === 'Ransa');
    const { getByTestId } = render(renderBannerItem_current(ransaWarehouse, 5000));

    const unitSpan = getByTestId('banner-unit-Ransa');

    // ASSERTION: el banner de Ransa DEBE mostrar "KG"
    // FALLA ESPERADA: el código actual muestra "LBS"
    expect(unitSpan).toHaveTextContent('KG');
  });
});

// ---------------------------------------------------------------------------
// Property 2 — Bug Condition: Formulario unificado muestra Kg/Kilogramos (KG)
// Validates: Requirements 1.2, 1.3, 1.4 (current) → 2.2, 2.3, 2.4 (expected)
//
// ESTOS TESTS DEBEN FALLAR: el código actual muestra "(Lbs)" y "Libras (LBS)".
// Las fallas confirman que el bug existe.
// ---------------------------------------------------------------------------
describe('Property 2 — Bug Condition: Formulario unificado debe mostrar Kg/Kilogramos (KG)', () => {
  it('el label "Peso según Viñeta" contiene "(Kg)" (FALLA ESPERADA: actualmente contiene "(Lbs)")', () => {
    render(renderUnifiedForm_current());

    const labelViñeta = screen.getByTestId('label-tag-weight');

    // ASSERTION: el label DEBE contener "(Kg)"
    // FALLA ESPERADA: el código actual contiene "(Lbs)"
    expect(labelViñeta).toHaveTextContent('(Kg)');
  });

  it('el label "Peso según Báscula" contiene "(Kg)" (FALLA ESPERADA: actualmente contiene "(Lbs)")', () => {
    render(renderUnifiedForm_current());

    const labelBáscula = screen.getByTestId('label-scale-weight');

    // ASSERTION: el label DEBE contener "(Kg)"
    // FALLA ESPERADA: el código actual contiene "(Lbs)"
    expect(labelBáscula).toHaveTextContent('(Kg)');
  });

  it('el input de Unidad tiene value "Kilogramos (KG)" (FALLA ESPERADA: actualmente tiene "Libras (LBS)")', () => {
    render(renderUnifiedForm_current());

    const inputUnit = screen.getByTestId('input-unit');

    // ASSERTION: el input DEBE tener value "Kilogramos (KG)"
    // FALLA ESPERADA: el código actual tiene "Libras (LBS)"
    expect(inputUnit).toHaveValue('Kilogramos (KG)');
  });
});
