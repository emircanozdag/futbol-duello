"""İsteğe bağlı: dcaribou/transfermarkt-datasets CSV'leri tm/ klasöründeyse
oyuncu-kulüp çiftlerini (transfermarkt id'leri ile) üretir.
https://github.com/dcaribou/transfermarkt-datasets (CC0)
Gerekli dosyalar: tm/appearances.csv (player_id, player_club_id)
"""
import csv, pathlib

HERE = pathlib.Path(__file__).parent

def load(tm_club_ids):
    """tm_club_ids: {transfermarkt_club_id: club_id}. Dönüş: {tm_player_id: set(club_id)}"""
    path = HERE / "tm" / "appearances.csv"
    if not path.exists():
        return {}
    out = {}
    with path.open(newline="") as f:
        for row in csv.DictReader(f):
            cid = tm_club_ids.get(row["player_club_id"])
            if cid:
                out.setdefault(row["player_id"], set()).add(cid)
    return out
