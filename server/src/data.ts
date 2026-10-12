import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalize, type Club, type Mode, type PlayerEntry } from "@duello/shared";

const dir = fileURLToPath(new URL("../../shared/data/", import.meta.url));
const load = <T>(f: string): T => JSON.parse(readFileSync(dir + f, "utf8"));

export interface GameData {
  clubs: Club[];
  players: Record<string, PlayerEntry>;
  pairs: Record<string, string[]>;
}

export const loadData = (): GameData => ({
  clubs: load("clubs.json"), players: load("players.json"), pairs: load("pairs.json"),
});

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export class Catalog {
  constructor(readonly data: GameData) {}

  clubsFor(mode: Mode) { return this.data.clubs.filter((c) => c.modes.includes(mode)); }
  hasClub(mode: Mode, id: string) { return this.clubsFor(mode).some((c) => c.id === id); }

  /** ortak oyuncular, ünlüden aza sıralı */
  commons(a: string, b: string): string[] {
    const ids = this.data.pairs[pairKey(a, b)] ?? [];
    return [...ids].sort((x, y) => this.data.players[y].f - this.data.players[x].f);
  }

  randomClub(mode: Mode, rand = Math.random) {
    const cs = this.clubsFor(mode);
    return cs[Math.floor(rand() * cs.length)].id;
  }

  /** en az `min` ortak oyuncusu olan rastgele bir çift */
  randomValidPair(mode: Mode, min = 3, rand = Math.random): [string, string] {
    const ids = new Set(this.clubsFor(mode).map((c) => c.id));
    const keys = Object.keys(this.data.pairs).filter((k) => {
      const [a, b] = k.split("|");
      return ids.has(a) && ids.has(b) && this.data.pairs[k].length >= min;
    });
    return keys[Math.floor(rand() * keys.length)].split("|") as [string, string];
  }

  /**
   * Cevabı ortak oyunculardan biriyle eşleştirir. Autocomplete'ten seçilen id varsa onu,
   * yoksa serbest metni (tam ad / takma ad / soyadı) dener.
   */
  match(commonIds: string[], playerId: string | undefined, text: string): string | null {
    if (playerId) return commonIds.includes(playerId) ? playerId : null;
    const t = normalize(text);
    if (t.length < 2) return null;
    const exact = commonIds.find((id) => this.data.players[id].k.includes(t));
    if (exact) return exact;
    const bySurname = commonIds.filter((id) => this.data.players[id].k.some((k) => k.split(" ").at(-1) === t));
    return bySurname.length >= 1 ? bySurname[0] : null;
  }

  name(id: string) { return this.data.players[id]?.n ?? id; }
}
