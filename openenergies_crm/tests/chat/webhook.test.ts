import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { postToWebhook } from '../../src/lib/chat/webhook';

const originalFetch = global.fetch;

describe('postToWebhook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch as any;
    vi.restoreAllMocks();
  });

  it('extracts reply from reply field', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: 'hola' }) });
    const res = await postToWebhook({ user_id: 'u1', name: 'John', message: 'Hi' });
    expect(res).toBe('hola');
  });

  it('extracts reply from message field', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message: 'hola' }) });
    const res = await postToWebhook({ user_id: 'u1', name: 'John', message: 'Hi' });
    expect(res).toBe('hola');
  });

  it('extracts reply from data.message field', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { message: 'hola' } }) });
    const res = await postToWebhook({ user_id: 'u1', name: 'John', message: 'Hi' });
    expect(res).toBe('hola');
  });

  it('extracts reply from text field', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: 'hola' }) });
    const res = await postToWebhook({ user_id: 'u1', name: 'John', message: 'Hi' });
    expect(res).toBe('hola');
  });

  it('retries on error and succeeds', async () => {
    const mocks = [
      { ok: false, status: 500 },
      { ok: true, json: async () => ({ message: 'ok' }) },
    ];
    let call = 0;
    global.fetch = vi.fn().mockImplementation(() => Promise.resolve(mocks[call++]));
    const promise = postToWebhook({ user_id: 'u1', name: 'John', message: 'Hi' });
    // advance timers for backoff
    await vi.runAllTimersAsync();
    const res = await promise;
    expect(res).toBe('ok');
    expect((global.fetch as any).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('fails after retries', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const promise = postToWebhook({ user_id: 'u1', name: 'John', message: 'Hi' });
    await expect(promise).rejects.toBeInstanceOf(Error);
  });
});


