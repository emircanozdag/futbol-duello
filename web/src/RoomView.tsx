import { useEffect, useMemo, useRef, useState } from "react";
import { RULES, type RoomState } from "@duello/shared";
import { clientId, saveName, savedName, socket } from "./socket.ts";
import { clubById, clubsFor, MODE_LABEL } from "./clubs.ts";
import { ClubBadge } from "./ClubBadge.tsx";
import { serverNow, syncClock, useRemaining } from "./useClock.ts";
import { loadPlayers, searchPlayers } from "./players.ts";

export function RoomView({ roomId, onLeave }: { roomId: string; onLeave: () => void }) {
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(savedName);
  const [named, setNamed] = useState(() => !!savedName());
  // bu turdaki autocomplete'ten seçilmiş yanlış cevaplarım (bildirim için)
  const [guesses, setGuesses] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const onWrong = ({ text, playerId }: { text: string; playerId?: string }) => {
      if (playerId) setGuesses((g) => (g.some((x) => x.id === playerId) ? g : [...g, { id: playerId, name: text }]));
    };
    socket.on("wrong", onWrong);
    return () => { socket.off("wrong", onWrong); };
  }, []);
  useEffect(() => { if (state?.phase === "answering") setGuesses([]); }, [state?.phase, state?.round]);

  useEffect(() => {
    loadPlayers();
    const onState = (s: RoomState) => { syncClock(s.serverNow); if (s.id === roomId) setState(s); };
    socket.on("state", onState);
    return () => { socket.off("state", onState); };
  }, [roomId]);

  // katıl + kopunca otomatik yeniden katıl
  useEffect(() => {
    if (!named) return;
    const join = () => socket.emit("join", { roomId, name: savedName(), clientId }, (ok, err) => !ok && setError(err ?? "Hata"));
    join();
    socket.io.on("reconnect", join);
    return () => { socket.io.off("reconnect", join); };
  }, [roomId, named]);

  if (error) return <section className="card"><h2>{error}</h2><button className="primary" onClick={onLeave}>Ana sayfa</button></section>;
  if (!named) {
    return (
      <section className="card home">
        <h2>Düelloya davet edildin ⚔️</h2>
        <label>Adın<input autoFocus value={name} maxLength={20} onChange={(e) => setName(e.target.value)} /></label>
        <button className="primary" onClick={() => { saveName(name.trim() || "Oyuncu"); setNamed(true); }}>Katıl</button>
      </section>
    );
  }
  if (!state) return <section className="card"><p className="muted">Bağlanıyor…</p></section>;

  const me = state.players.find((p) => p.id === clientId);
  const opp = state.players.find((p) => p.id !== clientId);

  return (
    <>
      <Scoreboard state={state} />
      {state.phase === "lobby" && <Lobby roomId={roomId} state={state} />}
      {state.phase === "countdown" && <Countdown state={state} />}
      {state.phase === "picking" && <Picking state={state} picked={!!me?.picked} oppPicked={!!opp?.picked} />}
      {state.phase === "reveal" && <Reveal state={state} />}
      {state.phase === "answering" && <Answering state={state} />}
      {state.phase === "roundEnd" && <RoundEnd state={state} guesses={guesses} />}
      {state.phase === "matchEnd" && <MatchEnd state={state} onLeave={onLeave} />}
    </>
  );
}

function Scoreboard({ state }: { state: RoomState }) {
  return (
    <div className="score">
      {state.players.map((p) => (
        <div key={p.id} className={`side ${p.id === clientId ? "me" : ""} ${p.connected ? "" : "off"}`}>
          <span className="pname">{p.name}{p.id === clientId && " (sen)"}{!p.connected && " ⚠︎"}</span>
          <span className="pts">{p.score}</span>
        </div>
      ))}
      {state.players.length < 2 && <div className="side off"><span className="pname">Rakip bekleniyor…</span><span className="pts">–</span></div>}
      <div className="meta">{MODE_LABEL[state.mode]} · {RULES.winScore} tur alan kazanır{state.round > 0 && ` · Tur ${state.round}`}</div>
    </div>
  );
}

function Timer({ deadline, total }: { deadline: number; total: number }) {
  const left = useRemaining(deadline);
  return (
    <div className="timer">
      <div className="bar" style={{ width: `${(left / total) * 100}%` }} />
      <span>{Math.ceil(left / 1000)}</span>
    </div>
  );
}

function Lobby({ roomId, state }: { roomId: string; state: RoomState }) {
  const link = `${location.origin}/r/${roomId}`;
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const text = `Futbol Düellosu'nda seni bekliyorum ⚽ (${MODE_LABEL[state.mode]})`;
    if (navigator.share) { try { await navigator.share({ title: "Futbol Düellosu", text, url: link }); return; } catch { /* iptal */ } }
    await navigator.clipboard.writeText(link);
    setCopied(true);
  };
  return (
    <section className="card center">
      <h2>Rakibini davet et</h2>
      <code className="link">{link}</code>
      <button className="primary" onClick={share}>{copied ? "Kopyalandı ✓" : "Linki paylaş"}</button>
      <p className="muted">Rakip linke girince maç otomatik başlar.</p>
    </section>
  );
}

function Countdown({ state }: { state: RoomState }) {
  const left = useRemaining(state.deadline);
  const n = Math.max(1, Math.ceil(left / 1000));
  return (
    <section className="card center">
      {state.message && <p className="warn">{state.message}</p>}
      <div key={n} className="big-count">{n}</div>
      <p className="muted">Kulübünü aklında tut…</p>
    </section>
  );
}

function Picking({ state, picked, oppPicked }: { state: RoomState; picked: boolean; oppPicked: boolean }) {
  const [q, setQ] = useState("");
  const [mine, setMine] = useState<string | null>(null);
  const list = useMemo(() => {
    const t = q.toLocaleLowerCase("tr");
    return clubsFor(state.mode).filter((c) => c.name.toLocaleLowerCase("tr").includes(t));
  }, [q, state.mode]);

  const choose = (id: string) => { setMine(id); socket.emit("pick", id); };

  return (
    <section className="card">
      <Timer deadline={state.deadline} total={RULES.pickMs} />
      {picked ? (
        <div className="center">
          {mine && <ClubBadge id={mine} size="lg" />}
          <p className="muted">{oppPicked ? "Açılıyor…" : "Rakibin seçiyor…"}</p>
        </div>
      ) : (
        <>
          <h2>Kulübünü seç {oppPicked && <span className="pill">rakip seçti</span>}</h2>
          <input autoFocus placeholder="Kulüp ara…" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && list[0] && choose(list[0].id)} />
          <div className="grid">
            {list.map((c) => (
              <button key={c.id} className="club-btn" onClick={() => choose(c.id)}><ClubBadge id={c.id} size="sm" /></button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Pair({ clubs }: { clubs: [string, string] }) {
  return (
    <div className="pair">
      <ClubBadge id={clubs[0]} size="lg" />
      <span className="x">×</span>
      <ClubBadge id={clubs[1]} size="lg" />
    </div>
  );
}

function Reveal({ state }: { state: RoomState }) {
  return (
    <section className="card center">
      {state.clubs && <Pair clubs={state.clubs} />}
      <p className="warn">{state.message}</p>
    </section>
  );
}

function Answering({ state }: { state: RoomState }) {
  const me = state.players.find((p) => p.id === clientId)!;
  const [text, setText] = useState("");
  const [shake, setShake] = useState(0);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const suggestions = searchPlayers(text);
  const out = me.wrong >= RULES.maxWrong;
  const locked = me.lockedUntil > serverNow();

  useEffect(() => {
    const onWrong = () => { setShake((s) => s + 1); setText(""); input.current?.focus(); };
    socket.on("wrong", onWrong);
    return () => { socket.off("wrong", onWrong); };
  }, []);
  useEffect(() => setActive(0), [text]);

  const send = (playerId?: string) => {
    if (!text.trim() && !playerId) return;
    const name = suggestions.find((s) => s.id === playerId)?.name;
    socket.emit("answer", { playerId, text: name ?? text });
  };

  return (
    <section className="card">
      <Timer deadline={state.deadline} total={RULES.answerMs} />
      {state.clubs && <Pair clubs={state.clubs} />}
      <p className="center muted">İki kulüpte de oynamış bir futbolcu yaz!</p>
      <div key={shake} className={`answer ${shake ? "shake" : ""}`}>
        <input ref={input} autoFocus disabled={out} value={text} placeholder={out ? "Bu turda hakkın bitti" : "Futbolcu adı…"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, suggestions.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter") send(suggestions[active]?.id);
          }} />
        {suggestions.length > 0 && !out && (
          <ul className="suggest">
            {suggestions.map((s, i) => (
              <li key={s.id} className={i === active ? "on" : ""} onMouseDown={(e) => { e.preventDefault(); send(s.id); }}>{s.name}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="tiny muted center">
        Yanlış hakkı: {RULES.maxWrong - me.wrong}/{RULES.maxWrong}{locked && " · 1 sn bekle"}
      </p>
    </section>
  );
}

function RoundEnd({ state, guesses }: { state: RoomState; guesses: { id: string; name: string }[] }) {
  const r = state.result!;
  const [reported, setReported] = useState<string[]>([]);
  const report = (id: string) => {
    socket.emit("report", { clubs: state.clubs!, playerId: id });
    setReported((x) => [...x, id]);
  };
  const winner = state.players.find((p) => p.id === r.winnerId);
  return (
    <section className="card center">
      {state.clubs && <Pair clubs={state.clubs} />}
      <h2>{winner ? `${winner.id === clientId ? "Sen" : winner.name} bildi! ✅` : "Kimse bilemedi ⏱"}</h2>
      {r.answer && <p className="answer-hit">{r.answer}</p>}
      <p className="muted tiny">Ortak oyuncular ({r.totalCommons}):</p>
      <p className="commons">{r.commons.join(" · ")}{r.totalCommons > r.commons.length && " …"}</p>
      {guesses.length > 0 && (
        <div className="reports">
          <p className="tiny muted">Cevabın doğru muydu? Verimiz eksik olabilir:</p>
          {guesses.map((g) => (
            <button key={g.id} className="ghost small" disabled={reported.includes(g.id)} onClick={() => report(g.id)}>
              {reported.includes(g.id) ? `${g.name} — bildirildi ✓` : `${g.name} doğruydu, bildir`}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function MatchEnd({ state, onLeave }: { state: RoomState; onLeave: () => void }) {
  const won = state.winnerId === clientId;
  const winner = state.players.find((p) => p.id === state.winnerId);
  const voted = state.rematchVotes.includes(clientId);
  const [copied, setCopied] = useState(false);

  const card = [
    `⚽ Futbol Düellosu — ${MODE_LABEL[state.mode]}`,
    state.players.map((p) => `${p.name} ${p.score}`).join(" – "),
    ...state.history.map((h) => {
      const w = state.players.find((p) => p.id === h.winnerId);
      return `${clubById[h.clubs[0]]?.name} × ${clubById[h.clubs[1]]?.name}: ${h.answer ? `${h.answer} (${w?.name})` : "—"}`;
    }),
    location.origin,
  ].join("\n");

  const share = async () => {
    if (navigator.share) { try { await navigator.share({ text: card }); return; } catch { /* iptal */ } }
    await navigator.clipboard.writeText(card);
    setCopied(true);
  };

  return (
    <section className="card center">
      <h1>{won ? "Kazandın! 🏆" : winner ? `${winner.name} kazandı` : "Maç bitti"}</h1>
      {state.message && <p className="warn">{state.message}</p>}
      <pre className="result-card">{card}</pre>
      <button className="primary" disabled={voted} onClick={() => socket.emit("rematch")}>
        {voted ? "Rakip bekleniyor…" : "Rövanş"}
      </button>
      <button className="ghost" onClick={share}>{copied ? "Kopyalandı ✓" : "Sonucu paylaş"}</button>
      <button className="link-btn" onClick={onLeave}>Ana sayfa</button>
    </section>
  );
}
