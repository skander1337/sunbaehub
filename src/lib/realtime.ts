/** In-process pub/sub for session rooms. One server process → one hub; survives Turbopack HMR via globalThis. */
type Listener = (event: string, data: unknown) => void;
const g = globalThis as unknown as { __sunbaeHub?: Map<string, Set<Listener>> };
const hub = g.__sunbaeHub ?? (g.__sunbaeHub = new Map());

export function subscribe(channel: string, listener: Listener): () => void {
  let set = hub.get(channel);
  if (!set) hub.set(channel, (set = new Set()));
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) hub.delete(channel);
  };
}

export function publish(channel: string, event: string, data: unknown): void {
  const set = hub.get(channel);
  if (!set) return;
  for (const l of set) {
    try {
      l(event, data);
    } catch {
      set.delete(l);
    }
  }
}
