import { normalize, type PlayerEntry } from "@duello/shared";

let pool: [string, PlayerEntry][] | null = null;
let loading: Promise<void> | null = null;

/** Tüm oyuncu havuzu (ortak listeler değil) — autocomplete cevabı ele vermesin diye. */
export function loadPlayers() {
  loading ??= fetch(`${import.meta.env.VITE_SERVER_URL ?? ""}/data/players.json`)
    .then((r) => r.json())
    .then((d: Record<string, PlayerEntry>) => {
      pool = Object.entries(d).sort((a, b) => b[1].f - a[1].f);
    });
  return loading;
}

export function searchPlayers(q: string, limit = 8): { id: string; name: string }[] {
  const t = normalize(q);
  if (!pool || t.length < 3) return [];
  const out: { id: string; name: string }[] = [];
  for (const [id, p] of pool) {
    if (p.k.some((k) => k.startsWith(t) || k.includes(" " + t))) out.push({ id, name: p.n });
    if (out.length >= limit) break;
  }
  return out;
}
