"""Wikidata (+ isteğe bağlı Transfermarkt) verisini birleştirip oyun verisini üretir.
Çıktı: ../shared/data/{clubs,players,pairs}.json ve yoğunluk raporu.
"""
import csv, itertools, json, pathlib
from normalize import normalize
import load_transfermarkt

HERE = pathlib.Path(__file__).parent
OUT = HERE.parent / "shared" / "data"
MIN_FAME = 3  # çok az bilinen (neredeyse hiç wiki sayfası olmayan) kayıtları ele

def main():
    clubs = json.loads((HERE / "clubs.json").read_text())
    raw = json.loads((HERE / "cache" / "wikidata_players.json").read_text())

    # Wikipedia kategori üyelikleri (güncel transferler için)
    cat_path = HERE / "cache" / "category_members.json"
    if cat_path.exists():
        added = 0
        for q, cs in json.loads(cat_path.read_text()).items():
            if q in raw:
                new = set(cs) - set(raw[q]["clubs"])
                added += len(new)
                raw[q]["clubs"] = sorted(set(raw[q]["clubs"]) | new)
        print(f"Wikipedia kategorilerinden {added} yeni oyuncu-kulüp bağı")

    tm_pairs = load_transfermarkt.load({c["tm"]: c["id"] for c in clubs if c.get("tm")})
    tm_to_q = {p["tm"]: q for q, p in raw.items() if p.get("tm")}
    for tm_id, cs in tm_pairs.items():
        if tm_id in tm_to_q:
            raw[tm_to_q[tm_id]]["clubs"] = sorted(set(raw[tm_to_q[tm_id]]["clubs"]) | cs)

    with (HERE / "overrides.csv").open(newline="") as f:
        for row in csv.DictReader(f):
            p = raw.setdefault(row["player_qid"], {"name": row.get("note"), "clubs": [], "aliases": [], "fame": 99})
            cs = set(p["clubs"])
            (cs.add if row["action"] == "add" else cs.discard)(row["club_id"])
            p["clubs"] = sorted(cs)

    players, pairs = {}, {}
    for q, p in raw.items():
        name = p.get("name")
        if not name or name.startswith("Q") or p.get("fame", 0) < MIN_FAME:
            continue
        keys = {normalize(n) for n in [name, p.get("en") or "", *p.get("aliases", [])] if n}
        keys.discard("")
        players[q] = {"n": name, "k": sorted(keys), "f": p.get("fame", 0)}
        for a, b in itertools.combinations(sorted(p["clubs"]), 2):
            pairs.setdefault(f"{a}|{b}", []).append(q)

    # sadece en az bir kulüp çiftinde yer alanlar + tüm havuz (autocomplete için) tutulur
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "clubs.json").write_text(json.dumps(
        [{k: c[k] for k in ("id", "name", "colors", "modes")} for c in clubs], ensure_ascii=False))
    (OUT / "players.json").write_text(json.dumps(players, ensure_ascii=False, separators=(",", ":")))
    (OUT / "pairs.json").write_text(json.dumps(pairs, separators=(",", ":")))

    print(f"{len(players)} oyuncu, {len(pairs)} dolu çift")
    for mode in ("tr", "eu"):
        ids = sorted(c["id"] for c in clubs if mode in c["modes"])
        all_pairs = list(itertools.combinations(ids, 2))
        filled = [p for p in all_pairs if f"{p[0]}|{p[1]}" in pairs]
        weak = sorted(ids, key=lambda i: sum(1 for p in filled if i in p))[:5]
        print(f"[{mode}] {len(ids)} kulüp, {len(filled)}/{len(all_pairs)} çift dolu "
              f"(%{100 * len(filled) // len(all_pairs)}); en zayıf: {weak}")

    def check(a, b, who):
        key = "|".join(sorted([a, b]))
        names = [players[q]["n"] for q in pairs.get(key, [])]
        ok = any(normalize(who) in normalize(n) for n in names)
        print(f"  kontrol {key}: {len(names)} ortak, '{who}' {'VAR' if ok else 'YOK'}")
    check("GS", "BAR", "Hagi"); check("FB", "BJK", "Aurélio"); check("GS", "BJK", "")
    check("FB", "INT", "Emre Belözoğlu"); check("GS", "INT", "Sneijder"); check("GS", "FB", ""); check("GS", "KONYA", "Bardakçı")

if __name__ == "__main__":
    main()
