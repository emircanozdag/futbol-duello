import { createServer } from "node:http";
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import type { ClientToServer, ServerToClient } from "@duello/shared";
import { Catalog, loadData } from "./data.ts";
import { Room } from "./room.ts";
import { BOT_ID, botTurn } from "./bot.ts";

const PORT = Number(process.env.PORT ?? 3001);
const catalog = new Catalog(loadData());
const rooms = new Map<string, Room>();
const REPORTS = fileURLToPath(new URL("../../data-pipeline/reports.jsonl", import.meta.url));

// İstemci autocomplete'i için oyuncu havuzu (ortak listeler değil — cevabı ele vermez)
const playersJson = readFileSync(fileURLToPath(new URL("../../shared/data/players.json", import.meta.url)));

const http = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.url === "/data/players.json") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" });
    return res.end(playersJson);
  }
  if (req.url === "/health") return res.end("ok");
  res.writeHead(404).end();
});

const io = new Server<ClientToServer, ServerToClient>(http, { cors: { origin: "*" } });

const newRoomId = () => {
  let id;
  do id = Math.random().toString(36).slice(2, 8); while (rooms.has(id));
  return id;
};

function makeRoom(mode: "tr" | "eu") {
  const id = newRoomId();
  const room = new Room(id, mode, catalog, {
    onState: (s) => io.to(id).emit("state", s),
    onWrong: (pid, text, guessId) => io.to(`${id}:${pid}`).emit("wrong", { text, playerId: guessId }),
    onPhase: (r, phase) => botTurn(r, phase),
  });
  rooms.set(id, room);
  return room;
}

io.on("connection", (socket) => {
  let room: Room | undefined;
  let me = "";

  const enter = (r: Room, clientId: string, name: string) => {
    if (!r.join(clientId, name)) return false;
    room = r;
    me = clientId;
    socket.join([r.id, `${r.id}:${clientId}`]);
    socket.emit("state", r.state());
    return true;
  };

  socket.on("create", ({ mode, name, clientId, bot }, ack) => {
    const r = makeRoom(mode === "eu" ? "eu" : "tr");
    ack(r.id);
    enter(r, clientId, name);
    if (bot) r.join(BOT_ID, "Bot 🤖", true);
  });

  socket.on("join", ({ roomId, name, clientId }, ack) => {
    const r = rooms.get(roomId);
    if (!r) return ack(false, "Oda bulunamadı");
    ack(enter(r, clientId, name), "Oda dolu");
  });

  socket.on("pick", (clubId) => room?.pick(me, clubId));
  socket.on("answer", ({ playerId, text }) => room?.answer(me, playerId, String(text ?? "").slice(0, 60)));
  socket.on("rematch", () => room?.rematch(me));
  socket.on("report", ({ clubs, playerId }) => {
    if (!room || !catalog.data.players[playerId] || !clubs?.every((c) => catalog.data.clubs.some((x) => x.id === c))) return;
    const line = { at: new Date().toISOString(), clubs, playerId, name: catalog.name(playerId) };
    appendFileSync(REPORTS, JSON.stringify(line) + "\n");
    console.log("bildirim:", line);
  });

  socket.on("disconnect", () => {
    if (!room) return;
    const r = room;
    r.disconnect(me);
    // herkes ayrılırsa odayı bir süre sonra temizle
    setTimeout(() => { if (r.empty) { r.dispose(); rooms.delete(r.id); } }, 60_000);
  });
});

http.listen(PORT, () => console.log(`Sunucu :${PORT} — ${Object.keys(catalog.data.players).length} oyuncu`));
