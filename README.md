# ⚽ Futbol Düellosu

İki kulüp, bir futbolcu, ilk bilen kazanır. Gerçek zamanlı 1v1 web oyunu.

## Çalıştırma
```bash
npm install
npm run dev          # sunucu :3001 + web :5173
npm test             # oyun motoru birim testleri
npx tsx server/scripts/smoke.ts   # çalışan sunucuya karşı iki istemcili uçtan uca test
```

## Yapı
- `data-pipeline/`: Wikidata'dan veri çekip `shared/data/*.json` üretir (bkz. kendi README'si)
- `shared/`: tipler, kurallar (`RULES`), isim normalizasyonu
- `server/`: Node + Socket.io, sunucu otoriter oda durumu (`room.ts`), bot (`bot.ts`)
- `web/`: React + Vite PWA

## Dağıtım
- Web: `npm run build -w web`, sonra `web/dist`'i Cloudflare Pages/Vercel'e yükle. Build sırasında `VITE_SERVER_URL=https://sunucu-adresin` verilmeli.
- Sunucu: Fly.io / Render'da `npm start -w server` (`PORT` ortam değişkeni).
