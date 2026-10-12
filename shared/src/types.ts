export type Mode = "tr" | "eu";

export interface Club { id: string; name: string; colors: [string, string]; modes: Mode[] }
/** n: görünen ad, k: normalize edilmiş anahtarlar, f: ünlülük (Wikidata sitelink sayısı) */
export interface PlayerEntry { n: string; k: string[]; f: number }

export type Phase = "lobby" | "countdown" | "picking" | "reveal" | "answering" | "roundEnd" | "matchEnd";

export const RULES = {
  countdownMs: 3000,
  pickMs: 8000,
  answerMs: 15000,
  revealMs: 2000,
  roundEndMs: 4000,
  wrongLockMs: 1000,
  maxWrong: 3,
  winScore: 5,
  noCommonLimit: 3,
  reconnectMs: 10000,
} as const;

export interface PublicPlayer {
  id: string; name: string; score: number; connected: boolean; isBot: boolean;
  picked: boolean; wrong: number; lockedUntil: number;
}

export interface RoundResult {
  winnerId: string | null;
  answer: string | null;
  /** turdaki ortak oyuncular (ünlüden aza, en fazla 12) */
  commons: string[];
  totalCommons: number;
}

export interface RoomState {
  id: string;
  mode: Mode;
  phase: Phase;
  round: number;
  players: PublicPlayer[];
  /** iki kulüp; sadece reveal'dan sonra dolu */
  clubs: [string, string] | null;
  deadline: number;
  message: string | null;
  result: RoundResult | null;
  history: { clubs: [string, string]; winnerId: string | null; answer: string | null }[];
  winnerId: string | null;
  rematchVotes: string[];
  serverNow: number;
}

export interface ServerToClient {
  state: (s: RoomState) => void;
  wrong: (p: { text: string; playerId?: string }) => void;
  error: (msg: string) => void;
}
export interface ClientToServer {
  create: (p: { mode: Mode; name: string; clientId: string; bot: boolean }, ack: (roomId: string) => void) => void;
  join: (p: { roomId: string; name: string; clientId: string }, ack: (ok: boolean, err?: string) => void) => void;
  pick: (clubId: string) => void;
  answer: (p: { playerId?: string; text: string }) => void;
  rematch: () => void;
  /** "cevabım doğruydu" bildirimi — veri düzeltmesi için */
  report: (p: { clubs: [string, string]; playerId: string }) => void;
}
