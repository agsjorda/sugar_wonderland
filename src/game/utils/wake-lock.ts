// wake-lock.ts
let wakeLockSentinel: any | null = null;

export async function requestWakeLock() {
  if (!('wakeLock' in navigator)){
    // console.log('[WakeLock] not supported');
    return; // not supported
  } 
  try {
    wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      // console.log('[WakeLock] released');
      wakeLockSentinel = null;
    });
    // console.log('[WakeLock] acquired');
  } catch (err) {
    // console.warn('[WakeLock] request failed:', err);
  }
}

export async function releaseWakeLock() {
  try {
    await wakeLockSentinel?.release?.();
  } catch {}
  wakeLockSentinel = null;
}

// Re-acquire when tab becomes visible again (locks auto-release on hide)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !wakeLockSentinel) {
    requestWakeLock();
  } else if (document.visibilityState !== 'visible' && wakeLockSentinel) {
    releaseWakeLock();
  }
});
