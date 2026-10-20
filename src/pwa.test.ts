import { afterEach, expect, it, vi } from 'vitest';
import { registerOfflineSupport } from './pwa';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('reports browsers without service-worker support', async () => {
  vi.stubGlobal('navigator', {});
  const state = vi.fn();
  await registerOfflineSupport(state);
  expect(state).toHaveBeenCalledWith('unsupported');
});

it('registers with the deployment scope and waits without forcing updates', async () => {
  vi.stubEnv('PROD', true);
  vi.stubEnv('BASE_URL', '/fp-master/');
  const registration = { waiting: {}, addEventListener: vi.fn() };
  const register = vi.fn().mockResolvedValue(registration);
  vi.stubGlobal('navigator', { serviceWorker: { register, ready: Promise.resolve(registration) } });
  const state = vi.fn();
  await registerOfflineSupport(state);
  expect(register).toHaveBeenCalledWith('/fp-master/sw.js', { scope: '/fp-master/', updateViaCache: 'none' });
  expect(state.mock.calls.map(([value]) => value)).toEqual(['registered', 'update-waiting']);
});

it('reports a registration failure without blocking the app', async () => {
  vi.stubEnv('PROD', true);
  vi.stubEnv('BASE_URL', '/fp-master/');
  vi.stubGlobal('navigator', { serviceWorker: { register: vi.fn().mockRejectedValue(new Error('denied')) } });
  const state = vi.fn();
  await registerOfflineSupport(state);
  expect(state).toHaveBeenCalledWith('error');
});
