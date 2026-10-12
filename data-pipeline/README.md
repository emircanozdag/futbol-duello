# data-pipeline

```bash
python3 fetch_wikidata.py   # Wikidata'dan P54 üyeliklerini çeker (cache/ altında önbelleklenir)
python3 fetch_categories.py # Wikipedia kulüp kategorileri (güncel transferler)
python3 build.py            # ../shared/data/*.json üretir + yoğunluk raporu
```

- Kulüp listesi ve modlar: `clubs.json`
- Elle düzeltme: `overrides.csv` (`add`/`remove`, player_qid, club_id)
- İsteğe bağlı Transfermarkt verisi: dcaribou/transfermarkt-datasets'ten `appearances.csv`'yi `tm/` altına koy,
  `clubs.json`'a kulüplerin `"tm"` id'lerini ekle, `build.py`'yi tekrar çalıştır.
- Veri: Wikidata (CC0).
- Oyuncu bildirimleri: `python3 review_reports.py` (liste), `--accept` (overrides.csv'ye ekler).
