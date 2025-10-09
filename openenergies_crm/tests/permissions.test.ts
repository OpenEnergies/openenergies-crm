import { describe, it, expect } from 'vitest';
import { canSeeModule } from '../src/lib/permissions';

describe('canSeeModule', ()=>{
  it('cliente solo ve contratos y documentos', ()=>{
    expect(canSeeModule('cliente','documentos')).toBe(true);
    expect(canSeeModule('cliente','contratos')).toBe(true);
    expect(canSeeModule('cliente','clientes')).toBe(false);
  });
});
