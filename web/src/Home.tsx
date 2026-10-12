import { useState } from "react";
import type { Mode } from "@duello/shared";
import { clientId, saveName, savedName, socket } from "./socket.ts";

export function Home({ onRoom }: { onRoom: (id: string) => void }) {
  const [name, setName] = useState(savedName);

  const create = (bot: boolean) => {
    const n = name.trim() || "Oyuncu";
    saveName(n);
    socket.emit("create", { mode: "eu" as Mode, name: n, clientId, bot }, (id) => onRoom(id));
  };

  return (
    <section className="card home">
      <h1>İki kulüp. Bir futbolcu.<br />İlk bilen kazanır.</h1>
      <p className="muted">3-2-1'de ikiniz de gizlice bir kulüp seçersiniz. İki kulüpte de oynamış bir futbolcuyu ilk yazan turu alır. 5 turu alan kazanır.</p>
      <label>Adın
        <input value={name} maxLength={20} placeholder="Örn. Emir" onChange={(e) => setName(e.target.value)} />
      </label>
      <button className="primary" onClick={() => create(false)}>Arkadaşına meydan oku</button>
      <button className="ghost" onClick={() => create(true)}>Bota karşı oyna 🤖</button>
      <p className="tiny muted">Kural: A takımında resmi maçta oynamış olmak. Kiralık dahil, altyapı hariç. Veri: Wikidata (CC0).</p>
    </section>
  );
}
