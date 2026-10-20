export type OfflineState = 'unsupported' | 'registered' | 'ready' | 'update-waiting' | 'error';

/**
 * Service-worker updates wait for all current app tabs to close. No forced reload,
 * automatic skipWaiting, or changes to learning data are performed here.
 */
export async function registerOfflineSupport(onState?: (state: OfflineState) => void): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    onState?.('unsupported');
    return;
  }
  // Only the production bundle includes the generated service worker.
  if (!import.meta.env.PROD) return;
  try {
    const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    });
    onState?.('registered');
    if (registration.waiting) onState?.('update-waiting');
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed') {
          onState?.(navigator.serviceWorker.controller ? 'update-waiting' : 'ready');
        }
      });
    });
    await navigator.serviceWorker.ready;
    if (!registration.waiting) onState?.('ready');
  } catch {
    onState?.('error');
  }
}
