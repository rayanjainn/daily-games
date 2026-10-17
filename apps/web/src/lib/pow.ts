import { api } from './api';

export interface SolvedPow {
  id: string;
  nonce: string;
}

/** Fetches a challenge and solves it in a worker. */
export async function solvePow(): Promise<SolvedPow> {
  const challenge = await api<{ id: string; salt: string; difficulty: number }>(
    '/api/auth/pow',
    {},
  );
  const worker = new Worker(new URL('./pow.worker.ts', import.meta.url), { type: 'module' });
  try {
    const nonce = await new Promise<string>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<{ nonce?: string; error?: string }>) =>
        e.data.nonce ? resolve(e.data.nonce) : reject(new Error(e.data.error ?? 'pow failed'));
      worker.onerror = (e) => reject(new Error(e.message));
      worker.postMessage({ salt: challenge.salt, difficulty: challenge.difficulty });
    });
    return { id: challenge.id, nonce };
  } finally {
    worker.terminate();
  }
}
