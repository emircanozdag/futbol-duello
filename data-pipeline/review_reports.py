"""Oyunculardan gelen "cevabım doğruydu" bildirimlerini listeler.
--accept ile hepsini overrides.csv'ye 'add' olarak ekler (önce elle kontrol et!).
"""
import collections, csv, json, pathlib, sys

HERE = pathlib.Path(__file__).parent
path = HERE / "reports.jsonl"
if not path.exists():
    sys.exit("Bildirim yok.")
seen = collections.Counter()
for line in path.read_text().splitlines():
    r = json.loads(line)
    seen[(r["playerId"], r["name"], tuple(r["clubs"]))] += 1
for (q, name, clubs), n in seen.most_common():
    print(f"{n:3}×  {name} ({q})  {clubs[0]} × {clubs[1]}")
if "--accept" in sys.argv:
    with (HERE / "overrides.csv").open("a", newline="") as f:
        w = csv.writer(f)
        for (q, name, clubs) in seen:
            for c in clubs:
                w.writerow(["add", q, c, name])
    path.rename(path.with_suffix(".jsonl.done"))
    print("overrides.csv'ye eklendi; build.py'yi çalıştır.")
