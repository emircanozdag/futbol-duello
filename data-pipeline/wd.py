"""Wikidata SPARQL yardımcıları (yeniden deneme + önbellek)."""
import hashlib, json, pathlib, time, urllib.parse, urllib.request

UA = {"User-Agent": "futbol-duello/0.1 (hobby project; emir)", "Accept": "application/sparql-results+json"}
CACHE = pathlib.Path(__file__).parent / "cache"
CACHE.mkdir(exist_ok=True)

def sparql(query, retries=5):
    key = CACHE / (hashlib.sha1(query.encode()).hexdigest() + ".json")
    if key.exists():
        return json.loads(key.read_text())
    data = urllib.parse.urlencode({"query": query}).encode()
    for i in range(retries):
        try:
            req = urllib.request.Request("https://query.wikidata.org/sparql", data=data, headers=UA)
            rows = json.load(urllib.request.urlopen(req, timeout=90))["results"]["bindings"]
            key.write_text(json.dumps(rows))
            return rows
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504):
                raise
            time.sleep(5 * (i + 1))
    raise RuntimeError("SPARQL başarısız")

def val(row, k):
    return row[k]["value"] if k in row else None

def qid(uri):
    return uri.rsplit("/", 1)[-1]
