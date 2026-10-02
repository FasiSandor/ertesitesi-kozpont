# Értesítési Központ

iPhone-first PWA személyes kommunikációs inboxhoz.

## Élő folyamat
iPhone alkalmazásértesítés → Shortcuts Notification automation → Supabase Edge Function → privát inbox → AI eseményfelismerés → Naptár.

Források: Messenger, Instagram, Facebook, TikTok, SMS/iMessage (Messages), illetve egyéb.

A rendszer nem olvassa közvetlenül más alkalmazások adatbázisát. Csak az iPhone Shortcuts által explicit továbbított értesítési címet/szöveget tárolja.

## Naptár
A biztos időpontot vagy határidőt tartalmazó értesítések automatikusan a `core.naptar_calendar_events` kanonikus Naptár-tárba kerülnek `source_kind=notification` jelöléssel. A bizonytalan vagy nem naptári üzenetek az inboxban maradnak.

## Biztonság
A Shortcut és a PWA személyes bearer kulccsal kapcsolódik. A kulcs SHA-256 lenyomata van az adatbázisban; service-role vagy Supabase titkos kulcs nincs a kliensben vagy a repóban.
