import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalize, RULES, type RoomState } from "@duello/shared";
import { Catalog, type GameData } from "../src/data.ts";
import { Room } from "../src/room.ts";

const data: GameData = {
  clubs: [
    { id: "GS", name: "Galatasaray", colors: ["#a00", "#ff0"], modes: ["tr"] },
    { id: "FB", name: "Fenerbahçe", colors: ["#00a", "#ff0"], modes: ["tr"] },
    { id: "BJK", name: "Beşiktaş", colors: ["#000", "#fff"], modes: ["tr"] },
    { id: "KAS", name: "Kasımpaşa", colors: ["#00f", "#fff"], modes: ["tr"] },
  ],
  players: {
    Q1: { n: "Hakan Şükür", k: ["hakan sukur"], f: 50 },
    Q2: { n: "Rüştü Reçber", k: ["rustu recber"], f: 40 },
    Q3: { n: "Gheorghe Hagi", k: ["gheorghe hagi", "hagi"], f: 90 },
  },
  pairs: { "FB|GS": ["Q1", "Q3"], "BJK|FB": ["Q2"], "BJK|GS": ["Q1", "Q2", "Q3"] },
};

let states: RoomState[];
let wrongs: string[];
const last = () => states.at(-1)!;

function setup() {
  states = []; wrongs = [];
  const room = new Room("r1", "tr", new Catalog(data), {
    onState: (s) => states.push(s),
    onWrong: (id) => wrongs.push(id),
  }, () => 0);
  room.join("a", "Ali");
  room.join("b", "Banu");
  return room;
}

/** geri sayımı geçip iki kulübü seçtirir */
function play(room: Room, a: string, b: string) {
  vi.advanceTimersByTime(RULES.countdownMs);
  expect(room.phase).toBe("picking");
  room.pick("a", a);
  room.pick("b", b);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("normalize", () => {
  it("Türkçe karakter ve aksanları sadeleştirir", () => {
    expect(normalize("Hakan Şükür")).toBe("hakan sukur");
    expect(normalize("  İLHAN   Mansız ")).toBe("ilhan mansiz");
    expect(normalize("Edin Džeko")).toBe("edin dzeko");
    expect(normalize("Mehmet Aurélio")).toBe(normalize("Mehmet Aurelio"));
  });
});

describe("Room", () => {
  it("iki oyuncu gelince geri sayım → seçim → cevap", () => {
    const room = setup();
    expect(room.phase).toBe("countdown");
    play(room, "GS", "FB");
    expect(room.phase).toBe("answering");
    expect(last().clubs).toEqual(["GS", "FB"]);
  });

  it("seçimler ikisi de seçene kadar gizli kalır", () => {
    const room = setup();
    vi.advanceTimersByTime(RULES.countdownMs);
    room.pick("a", "GS");
    expect(last().clubs).toBeNull();
    expect(last().players.find((p) => p.id === "a")!.picked).toBe(true);
    expect(JSON.stringify(last())).not.toContain('"GS"');
  });

  it("serbest metin, soyadı ve autocomplete id ile doğru cevap", () => {
    const room = setup();
    play(room, "GS", "FB");
    room.answer("b", undefined, "hagi");
    expect(room.phase).toBe("roundEnd");
    expect(last().result!.winnerId).toBe("b");
    expect(last().result!.answer).toBe("Gheorghe Hagi");
    expect(last().result!.commons[0]).toBe("Gheorghe Hagi"); // ünlülüğe göre sıralı
  });

  it("aynı anda iki doğru cevap → önce gelen kazanır", () => {
    const room = setup();
    play(room, "GS", "FB");
    room.answer("a", "Q1", "");
    room.answer("b", "Q3", "");
    expect(last().result!.winnerId).toBe("a");
    expect(room.player("a")!.score).toBe(1);
    expect(room.player("b")!.score).toBe(0);
  });

  it("ortak oyuncu yoksa tur sayılmaz, yeniden seçilir", () => {
    const room = setup();
    play(room, "GS", "KAS");
    expect(room.phase).toBe("reveal");
    expect(last().message).toMatch(/Ortak oyuncu yok/);
    expect(room.round).toBe(0);
    vi.advanceTimersByTime(RULES.revealMs);
    expect(room.phase).toBe("countdown");
  });

  it("üst üste 3 ortak-yok → sistem geçerli bir çift atar", () => {
    const room = setup();
    for (let i = 0; i < 2; i++) { play(room, "GS", "KAS"); vi.advanceTimersByTime(RULES.revealMs); }
    play(room, "FB", "KAS");
    expect(last().message).toMatch(/sistem bir çift seçti/);
    vi.advanceTimersByTime(RULES.revealMs);
    expect(room.phase).toBe("answering");
    expect(room.commonIds.length).toBeGreaterThanOrEqual(1);
  });

  it("aynı kulüp seçilirse yeniden seçilir", () => {
    const room = setup();
    play(room, "GS", "GS");
    expect(last().message).toMatch(/Aynı kulübü/);
  });

  it("yanlış cevap 1 sn kilitler, 3 yanlıştan sonra tur kapanır", () => {
    const room = setup();
    play(room, "GS", "FB");
    room.answer("a", undefined, "messi");
    room.answer("a", undefined, "hagi"); // kilitli → yok sayılır
    expect(room.phase).toBe("answering");
    expect(wrongs).toEqual(["a"]);
    vi.advanceTimersByTime(RULES.wrongLockMs);
    room.answer("a", undefined, "x1");
    vi.advanceTimersByTime(RULES.wrongLockMs);
    room.answer("a", undefined, "x2");
    vi.advanceTimersByTime(RULES.wrongLockMs);
    room.answer("a", undefined, "hagi"); // hakkı bitti
    expect(room.phase).toBe("answering");
    expect(room.player("a")!.wrong).toBe(3);
  });

  it("süre biterse kimse puan almaz", () => {
    const room = setup();
    play(room, "GS", "FB");
    vi.advanceTimersByTime(RULES.answerMs);
    expect(last().result!.winnerId).toBeNull();
    expect(last().result!.totalCommons).toBe(2);
  });

  it("seçim süresi dolarsa seçmeyen için rastgele kulüp", () => {
    const room = setup();
    vi.advanceTimersByTime(RULES.countdownMs);
    room.pick("a", "FB");
    vi.advanceTimersByTime(RULES.pickMs);
    expect(last().clubs).toEqual(["FB", "GS"]); // rand=0 → ilk kulüp
  });

  it("5 turu alan maçı kazanır, rövanş sıfırlar", () => {
    const room = setup();
    for (let i = 0; i < RULES.winScore; i++) {
      play(room, "GS", "BJK");
      room.answer("a", "Q1", "");
      vi.advanceTimersByTime(RULES.roundEndMs);
    }
    expect(room.phase).toBe("matchEnd");
    expect(last().winnerId).toBe("a");
    room.rematch("a");
    expect(room.phase).toBe("matchEnd");
    room.rematch("b");
    expect(room.phase).toBe("countdown");
    expect(room.player("a")!.score).toBe(0);
  });

  it("kopup 10 sn içinde dönen devam eder, dönmeyen hükmen kaybeder", () => {
    const room = setup();
    play(room, "GS", "FB");
    room.disconnect("b");
    vi.advanceTimersByTime(5000);
    room.join("b", "Banu");
    vi.advanceTimersByTime(RULES.reconnectMs);
    expect(room.phase).not.toBe("matchEnd");

    room.disconnect("b");
    vi.advanceTimersByTime(RULES.reconnectMs);
    expect(room.phase).toBe("matchEnd");
    expect(last().winnerId).toBe("a");
  });

  it("üçüncü oyuncu odaya giremez", () => {
    const room = setup();
    expect(room.join("c", "Can")).toBe(false);
  });
});
