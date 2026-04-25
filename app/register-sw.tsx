'use client';
import { useEffect } from 'react';

export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[SW] Registrado:', reg.scope);
        // Verifica updates a cada 60min
        setInterval(() => reg.update(), 60 * 60 * 1000);
      })
      .catch((err) => console.error('[SW] Falha:', err));
  }, []);

  return null;
}
