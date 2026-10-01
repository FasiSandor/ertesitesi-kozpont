# Értesítési Központ

iPhone-first PWA egy egységes, prémium értesítési és üzenetközpont felülethez.

## Jelenlegi funkciók

- Messenger / Instagram / Facebook / TikTok nézet és szűrés
- keresés név, üzenet és forrás alapján
- olvasatlan állapot helyi megőrzése
- fontos beszélgetések
- üzenetrészlet és visszaugrás az eredeti szolgáltatásba
- telepíthető PWA
- Service Worker + saját próbaértesítés
- iPhone safe-area és standalone nézet

## Fontos iOS-korlát

Az iOS nem ad általános hozzáférést más alkalmazások rendszerértesítéseihez. Ezért az alkalmazás nem állítja, hogy közvetlenül kiolvassa a Messenger, Instagram, Facebook vagy TikTok értesítéseit. Valós üzenetadat csak külön, engedélyezett forráscsatlakozón keresztül kerülhet be.

## Fejlesztés

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
