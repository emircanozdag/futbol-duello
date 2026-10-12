import { io, type Socket } from "socket.io-client";
import type { ClientToServer, ServerToClient } from "@duello/shared";

export const socket: Socket<ServerToClient, ClientToServer> = io(import.meta.env.VITE_SERVER_URL ?? "", {
  transports: ["websocket"],
});

const get = (s: Storage, k: string) => { try { return s.getItem(k); } catch { return null; } };
const set = (s: Storage, k: string, v: string) => { try { s.setItem(k, v); } catch { /* yok say */ } };

/** Sekme başına kimlik: yenilemede aynı kalır (yeniden bağlanma), iki sekme iki farklı oyuncu olur. */
export const clientId = (() => {
  let id = get(sessionStorage, "duello.clientId");
  if (!id) { id = crypto.randomUUID(); set(sessionStorage, "duello.clientId", id); }
  return id;
})();

export const savedName = () => get(localStorage, "duello.name") ?? "";
export const saveName = (n: string) => set(localStorage, "duello.name", n);
