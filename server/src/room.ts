import { RULES, type Mode, type Phase, type PublicPlayer, type RoomState, type RoundResult } from "@duello/shared";
import type { Catalog } from "./data.ts";

interface Player extends PublicPlayer {
  pick: string | null;
  dropTimer?: ReturnType<typeof setTimeout>;
}

export interface RoomEvents {
  onState(state: RoomState): void;
  onWrong(playerId: string, text: string, guessId?: string): void;
  /** bot hamlelerini planlamak için */
  onPhase?(room: Room, phase: Phase): void;
}

/** Sunucu otoriter 1v1 oda durumu. Tüm zamanlama burada. */
export class Room {
  phase: Phase = "lobby";
  round = 0;
  players: Player[] = [];
  clubs: [string, string] | null = null;
  commonIds: string[] = [];
  deadline = 0;
  message: string | null = null;
  result: RoundResult | null = null;
  history: RoomState["history"] = [];
  winnerId: string | null = null;
  rematchVotes = new Set<string>();
  noCommonStreak = 0;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    readonly id: string,
    readonly mode: Mode,
    readonly catalog: Catalog,
    private events: RoomEvents,
    private rand: () => number = Math.random,
  ) {}

  // ---------- oyuncu yönetimi ----------

  join(id: string, name: string, isBot = false): boolean {
    const existing = this.players.find((p) => p.id === id);
    if (existing) {
      existing.connected = true;
      clearTimeout(existing.dropTimer);
      this.emit();
      return true;
    }
    if (this.players.length >= 2) return false;
    this.players.push({
      id, name: name.slice(0, 20) || "Oyuncu", score: 0, connected: true, isBot,
      picked: false, pick: null, wrong: 0, lockedUntil: 0,
    });
    if (this.players.length === 2 && this.phase === "lobby") this.startCountdown();
    else this.emit();
    return true;
  }

  disconnect(id: string) {
    const p = this.player(id);
    if (!p) return;
    p.connected = false;
    if (this.phase !== "lobby" && this.phase !== "matchEnd") {
      p.dropTimer = setTimeout(() => {
        if (p.connected) return;
        const other = this.opponent(id);
        this.endMatch(other?.id ?? null, `${p.name} bağlantıyı kaybetti — hükmen galibiyet`);
      }, RULES.reconnectMs);
    }
    this.emit();
  }

  get empty() { return this.players.every((p) => !p.connected || p.isBot); }

  // ---------- oyuncu aksiyonları ----------

  pick(id: string, clubId: string) {
    const p = this.player(id);
    if (!p || this.phase !== "picking" || p.pick || !this.catalog.hasClub(this.mode, clubId)) return;
    p.pick = clubId;
    p.picked = true;
    if (this.players.every((x) => x.pick)) this.resolvePicks();
    else this.emit();
  }

  answer(id: string, playerId: string | undefined, text: string) {
    const p = this.player(id);
    const now = Date.now();
    if (!p || this.phase !== "answering" || p.wrong >= RULES.maxWrong || now < p.lockedUntil) return;
    const hit = this.catalog.match(this.commonIds, playerId, text);
    if (hit) {
      p.score++;
      this.endRound(p.id, this.catalog.name(hit));
    } else {
      p.wrong++;
      p.lockedUntil = now + RULES.wrongLockMs;
      this.events.onWrong(p.id, text, playerId);
      if (this.players.every((x) => x.wrong >= RULES.maxWrong)) this.endRound(null, null);
      else this.emit();
    }
  }

  rematch(id: string) {
    if (this.phase !== "matchEnd" || !this.player(id)) return;
    this.rematchVotes.add(id);
    if (this.players.length === 2 && this.players.every((p) => this.rematchVotes.has(p.id) || p.isBot)) {
      for (const p of this.players) p.score = 0;
      this.round = 0;
      this.history = [];
      this.winnerId = null;
      this.rematchVotes.clear();
      this.startCountdown();
    } else this.emit();
  }

  // ---------- akış ----------

  private startCountdown(message: string | null = null) {
    this.clubs = null;
    this.commonIds = [];
    this.result = null;
    this.message = message;
    for (const p of this.players) Object.assign(p, { pick: null, picked: false, wrong: 0, lockedUntil: 0 });
    this.go("countdown", RULES.countdownMs, () => this.go("picking", RULES.pickMs, () => this.pickTimeout()));
  }

  private pickTimeout() {
    // seçmeyen oyuncuya rastgele kulüp
    for (const p of this.players) if (!p.pick) { p.pick = this.catalog.randomClub(this.mode, this.rand); p.picked = true; }
    this.resolvePicks();
  }

  private resolvePicks() {
    const [a, b] = this.players.map((p) => p.pick!) as [string, string];
    this.clubs = [a, b];
    if (a === b) {
      return this.go("reveal", RULES.revealMs, () => this.startCountdown(), "Aynı kulübü seçtiniz — yeniden seçin");
    }
    const commons = this.catalog.commons(a, b);
    if (commons.length === 0) {
      this.noCommonStreak++;
      if (this.noCommonStreak >= RULES.noCommonLimit) {
        this.noCommonStreak = 0;
        const pair = this.catalog.randomValidPair(this.mode, 3, this.rand);
        return this.go("reveal", RULES.revealMs, () => this.startAnswering(pair),
          "Üst üste 3 kez ortak oyuncu yok — sistem bir çift seçti");
      }
      return this.go("reveal", RULES.revealMs, () => this.startCountdown(), "Ortak oyuncu yok — yeniden seçin");
    }
    this.noCommonStreak = 0;
    this.startAnswering([a, b]);
  }

  private startAnswering(pair: [string, string]) {
    this.clubs = pair;
    this.commonIds = this.catalog.commons(pair[0], pair[1]);
    this.round++;
    this.message = null;
    this.go("answering", RULES.answerMs, () => this.endRound(null, null));
  }

  private endRound(winnerId: string | null, answer: string | null) {
    this.result = {
      winnerId, answer,
      commons: this.commonIds.slice(0, 12).map((id) => this.catalog.name(id)),
      totalCommons: this.commonIds.length,
    };
    this.history.push({ clubs: this.clubs!, winnerId, answer });
    const champion = this.players.find((p) => p.score >= RULES.winScore);
    this.go("roundEnd", RULES.roundEndMs, () => (champion ? this.endMatch(champion.id) : this.startCountdown()));
  }

  private endMatch(winnerId: string | null, message: string | null = null) {
    clearTimeout(this.timer);
    this.winnerId = winnerId;
    this.message = message;
    this.phase = "matchEnd";
    this.deadline = 0;
    this.emit();
    this.events.onPhase?.(this, "matchEnd");
  }

  private go(phase: Phase, ms: number, next: () => void, message?: string) {
    clearTimeout(this.timer);
    this.phase = phase;
    if (message !== undefined) this.message = message;
    this.deadline = Date.now() + ms;
    this.timer = setTimeout(next, ms);
    this.emit();
    this.events.onPhase?.(this, phase);
  }

  // ---------- yardımcılar ----------

  player(id: string) { return this.players.find((p) => p.id === id); }
  opponent(id: string) { return this.players.find((p) => p.id !== id); }

  dispose() {
    clearTimeout(this.timer);
    for (const p of this.players) clearTimeout(p.dropTimer);
  }

  state(): RoomState {
    return {
      id: this.id, mode: this.mode, phase: this.phase, round: this.round,
      players: this.players.map(({ pick, dropTimer, ...pub }) => pub),
      clubs: this.clubs, deadline: this.deadline, message: this.message, result: this.result,
      history: this.history, winnerId: this.winnerId, rematchVotes: [...this.rematchVotes],
      serverNow: Date.now(),
    };
  }

  private emit() { this.events.onState(this.state()); }
}
