import { RULES, type Phase } from "@duello/shared";
import type { Room } from "./room.ts";

export const BOT_ID = "bot";

/** Basit bot: rastgele kulüp seçer, %70 ihtimalle 6–12 sn içinde doğru cevap verir. */
export function botTurn(room: Room, phase: Phase, rand = Math.random) {
  if (!room.player(BOT_ID)) return;
  if (phase === "picking") {
    setTimeout(() => room.pick(BOT_ID, room.catalog.randomClub(room.mode, rand)), 1000 + rand() * 2500);
  } else if (phase === "answering") {
    const round = room.round;
    const delay = 6000 + rand() * 6000;
    const correct = rand() < 0.7;
    setTimeout(() => {
      if (room.phase !== "answering" || room.round !== round) return;
      if (!correct) return room.answer(BOT_ID, "bot-yanlis", "...");
      // ünlülerden biraz daha olası seç
      const pool = room.commonIds.slice(0, Math.max(3, Math.ceil(room.commonIds.length / 2)));
      room.answer(BOT_ID, pool[Math.floor(rand() * pool.length)], "");
    }, Math.min(delay, RULES.answerMs - 500));
  } else if (phase === "matchEnd") {
    room.rematch(BOT_ID);
  }
}
