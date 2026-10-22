/** Bounded workers always finish their in-flight work before returning an error. */
export async function executarFila<T>(items: T[], process: (item: T, index: number) => Promise<void>, concurrency = 4) {
  let next = 0;
  let failure: unknown;
  let failed = false;
  const worker = async () => {
    while (!failed) {
      const index = next++;
      if (index >= items.length) return;
      try { await process(items[index], index); }
      catch (error) { failed = true; failure = error; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, worker));
  if (failed) throw failure;
}

/** Serializes log batches without one HTTP request per attachment. */
export function criarGravadorLotes<T>(write: (items: T[]) => Promise<void>, size = 50) {
  let pending: T[] = [];
  let chain = Promise.resolve();
  let failure: unknown;
  let failed = false;
  const flush = async () => {
    if (pending.length) {
      const batch = pending;
      pending = [];
      chain = chain.then(async () => {
        if (failed) return;
        try { await write(batch); }
        catch (error) { failed = true; failure = error; }
      });
    }
    await chain;
    if (failed) throw failure;
  };
  return {
    async add(item: T) {
      if (failed) throw failure;
      pending.push(item);
      if (pending.length >= size) await flush();
    },
    flush,
  };
}

export function percentualAnexos(completed: number, total: number, active: number[]) {
  if (total <= 0) return 0;
  const partial = active.reduce((sum, progress) => sum + Math.min(0.95, Math.max(0, progress)), 0);
  return Math.min(100, Math.max(0, (completed + partial) / total * 100));
}