"""clubs.json'daki kulüplerin P54 (member of sports team) üyelerini Wikidata'dan çeker.
Çıktı: cache/wikidata_players.json
"""
import json, pathlib
from wd import sparql, val, qid

HERE = pathlib.Path(__file__).parent
FOOTBALLER = "Q937857"

def fetch_members(club_qid):
    # Sadece futbolcular; dönem bilgisi (varsa) ve kiralık işareti
    return sparql(f"""
SELECT ?p ?start ?end ?loan WHERE {{
  ?p p:P54 ?st . ?st ps:P54 wd:{club_qid} .
  ?p wdt:P106 wd:{FOOTBALLER} .
  OPTIONAL {{ ?st pq:P580 ?start }}
  OPTIONAL {{ ?st pq:P582 ?end }}
  OPTIONAL {{ ?st pq:P1642 ?loan }}
}}""")

def fetch_player_info(qids):
    vals = " ".join(f"wd:{q}" for q in qids)
    return sparql(f"""
SELECT ?p ?tr ?en ?tm ?links (GROUP_CONCAT(DISTINCT ?alias; separator="|") AS ?aliases) WHERE {{
  VALUES ?p {{ {vals} }}
  OPTIONAL {{ ?p rdfs:label ?tr FILTER(lang(?tr)="tr") }}
  OPTIONAL {{ ?p rdfs:label ?en FILTER(lang(?en)="en") }}
  OPTIONAL {{ ?p wdt:P2446 ?tm }}
  OPTIONAL {{ ?p wikibase:sitelinks ?links }}
  OPTIONAL {{ ?p skos:altLabel ?alias FILTER(lang(?alias) IN ("tr","en")) }}
}} GROUP BY ?p ?tr ?en ?tm ?links""")

def main():
    clubs = json.loads((HERE / "clubs.json").read_text())
    memberships = {}  # player qid -> set(club id)
    for c in clubs:
        for cq in c["qids"]:
            rows = fetch_members(cq)
            for r in rows:
                memberships.setdefault(qid(val(r, "p")), set()).add(c["id"])
            print(f"{c['id']:6} {cq:10} {len(rows):5} kayıt")
    qids = sorted(memberships)
    info = {}
    for i in range(0, len(qids), 300):
        for r in fetch_player_info(qids[i:i + 300]):
            q = qid(val(r, "p"))
            info[q] = {
                "name": val(r, "tr") or val(r, "en"),
                "en": val(r, "en"),
                "tm": val(r, "tm"),
                "fame": int(val(r, "links") or 0),
                "aliases": [a for a in (val(r, "aliases") or "").split("|") if a],
            }
    out = {q: {**info.get(q, {}), "clubs": sorted(cs)} for q, cs in memberships.items()}
    (HERE / "cache" / "wikidata_players.json").write_text(json.dumps(out, ensure_ascii=False))
    print(len(out), "oyuncu")

if __name__ == "__main__":
    main()
