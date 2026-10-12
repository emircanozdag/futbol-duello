// Çalışan sunucuya karşı iki istemcili uçtan uca duman testi: npx tsx scripts/smoke.ts
import { io } from "socket.io-client";
import type { RoomState } from "@duello/shared";
import { Catalog, loadData } from "../src/data.ts";

const URL = process.env.SERVER ?? "http://localhost:3001";
const cat = new Catalog(loadData());
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(17, 23), ...a);

function client(id: string) {
  const s = io(URL, { transports: ["websocket"], forceNew: true });
  const c = { s, id, state: null as RoomState | null };
  s.on("state", (st) => (c.state = st));
  return c;
}
async function until(c: { state: RoomState | null }, ok: (s: RoomState) => boolean, ms = 20000) {
  const t = Date.now();
  while (!(c.state && ok(c.state))) { if (Date.now() - t > ms) throw new Error("zaman aşımı: " + c.state?.phase); await sleep(50); }
  return c.state!;
}

const a = client("A"), b = client("B");
const roomId: string = await new Promise((r) => a.s.emit("create", { mode: "tr", name: "Ali", clientId: "A", bot: false }, r));
log("oda", roomId);
await new Promise((r) => b.s.emit("join", { roomId, name: "Banu", clientId: "B" }, r));
const full = await new Promise<[boolean, string?]>((r) => client("C").s.emit("join", { roomId, name: "Can", clientId: "C" }, (ok, e) => r([ok, e])));
log("3. oyuncu:", full);

// Tur 1: GS × FB, B yanlış sonra A doğru (aynı anda)
await until(a, (s) => s.phase === "picking");
a.s.emit("pick", "GS");
await sleep(200);
log("A seçti, B görüyor mu?", JSON.stringify(b.state!.clubs), "picked:", b.state!.players.find((p) => p.id === "A")!.picked);
b.s.emit("pick", "FB");
await until(a, (s) => s.phase === "answering");
const [top] = cat.commons("GS", "FB");
b.s.emit("answer", { text: "lionel messi" });
a.s.emit("answer", { text: cat.name(top) });
b.s.emit("answer", { playerId: top, text: "" });
const r1 = await until(a, (s) => s.phase === "roundEnd");
log("tur 1 kazanan:", r1.result!.winnerId, r1.result!.answer, "skor", r1.players.map((p) => p.score));

// Tur 2: B koparsa ve 3 sn sonra dönerse oyun sürer
await until(a, (s) => s.phase === "picking");
b.s.disconnect();
await sleep(300);
log("B koptu → connected:", a.state!.players.find((p) => p.id === "B")!.connected);
await sleep(3000);
const b2 = client("B");
await new Promise((r) => b2.s.emit("join", { roomId, name: "Banu", clientId: "B" }, r));
await sleep(300);
log("B döndü → connected:", a.state!.players.find((p) => p.id === "B")!.connected, "faz:", a.state!.phase);

// B tekrar kopar ve dönmez → 10 sn sonra A hükmen kazanır
b2.s.disconnect();
const end = await until(a, (s) => s.phase === "matchEnd", 30000);
log("maç sonu:", end.winnerId, end.message);
process.exit(0);
