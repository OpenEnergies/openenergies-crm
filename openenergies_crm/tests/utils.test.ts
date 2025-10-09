import { describe, it, expect } from 'vitest';
import { buildStoragePath } from '../src/lib/utils';

describe('buildStoragePath', ()=>{
  it('formatea el nombre y antepone cliente', ()=>{
    const p = buildStoragePath({ clienteId: 'aaa-bbb', fileName: 'Factura Julio 2025.pdf' });
    expect(p.startsWith('clientes/aaa-bbb/')).toBe(true);
    expect(p.endsWith('_Factura_Julio_2025.pdf')).toBe(true);
  });
});
