"""Wikipedia "<kulüp> futbolcuları" kategorilerinden üyelikleri çeker (en + tr).
Wikidata P54'te eksik kalan güncel transferleri tamamlar.
Çıktı: cache/category_members.json  {player_qid: [club_id...]}
"""
import json, pathlib, time, urllib.parse, urllib.request
from wd import sparql, val, qid

HERE = pathlib.Path(__file__).parent
UA = {"User-Agent": "futbol-duello/0.1 (hobby project)"}

def api(lang, params):
    u = f"https://{lang}.wikipedia.org/w/api.php?" + urllib.parse.urlencode({**params, "format": "json"})
    for i in range(5):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60))
        except urllib.error.HTTPError as e:
            if e.code != 429: raise
            time.sleep(5 * (i + 1))

def members(lang, cat):
    """kategori üyelerinin Wikidata QID'leri"""
    out, cont = set(), {}
    while True:
        r = api(lang, {"action": "query", "generator": "categorymembers", "gcmtitle": cat, "gcmnamespace": 0,
                       "gcmlimit": 500, "prop": "pageprops", "ppprop": "wikibase_item", **cont})
        for p in (r.get("query", {}).get("pages", {}) or {}).values():
            q = p.get("pageprops", {}).get("wikibase_item")
            if q: out.add(q)
        if "continue" not in r: return out
        cont = r["continue"]

def main():
    clubs = json.loads((HERE / "clubs.json").read_text())
    q2club = {q: c["id"] for c in clubs for q in c["qids"]}
    vals = " ".join(f"wd:{q}" for q in q2club)
    rows = sparql(f"""SELECT ?c ?lang ?title WHERE {{ VALUES ?c {{ {vals} }}
      ?c wdt:P6112 ?cat . ?art schema:about ?cat ; schema:isPartOf ?site ; schema:name ?title .
      VALUES (?site ?lang) {{ (<https://en.wikipedia.org/> "en") (<https://tr.wikipedia.org/> "tr") }} }}""")
    result = {}
    for r in rows:
        club, lang, title = q2club[qid(val(r, "c"))], val(r, "lang"), val(r, "title")
        ms = members(lang, title)
        for q in ms: result.setdefault(q, set()).add(club)
        print(f"{club:6} {lang} {len(ms):5}  {title}")
    (HERE / "cache" / "category_members.json").write_text(json.dumps({k: sorted(v) for k, v in result.items()}))
    print(len(result), "oyuncu")

if __name__ == "__main__":
    main()
