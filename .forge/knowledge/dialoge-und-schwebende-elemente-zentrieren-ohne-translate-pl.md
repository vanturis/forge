---
title: "Dialoge auf macOS: zentrieren ohne translate, kein flex-1 im Inhalt (WebKit, zusammengezogene Dialoge)"
summary: "Zwei WebKit-Fallen in Dialogen: translate plus Einblend-Animation verschiebt sie, flex-1 im h-fit-Dialog lässt den Inhalt auf das Padding zusammenfallen. Dazu, wie man das unter Windows mit altem WebKit nachstellt."
tags: ["ui","stolperfalle","tauri","konvention"]
updated: "2026-10-31T11:48:20.160Z"
---

## Zentrieren ohne translate
Gemeldet 2026-10-22: Auf macOS lagen die Bestätigungs-Knöpfe in Dialogen ab und zu verschoben.

Ursache (Annahme, nicht in WebKit nachgestellt): Tailwind v4 setzt `-translate-x-1/2` über die CSS-Eigenschaft `translate`. Die Einblend-Keyframes (`forge-pop-in`, `forge-palette-in`, `forge-rise-in` in `styles.css`) animieren `transform`, mit fill-mode `both`. WKWebView (macOS) wendet `translate` bei einer beschleunigten transform-Animation auf demselben Element nicht zuverlässig an. Dann sitzt der Dialog um die halbe Breite und Höhe nach rechts unten versetzt. WebView2 (Windows) ist nicht betroffen.

Regel: Ein Element mit transform-Animation wird nicht über `translate` zentriert.
- Dialoge (`components/ui/dialog.tsx`): `fixed inset-0 m-auto h-fit` plus Breite und `max-h`. Eigene Höhen (`h-[80vh]`, `h-150`) überschreiben `h-fit` über twMerge.
- Nur horizontal (CommandPalette, JumpToEnd in `FollowScroll.tsx`): `inset-x-0 mx-auto` plus Breite bzw. `w-fit`.
- Ist die Position berechnet (Screenshot-Leiste in `ScreenshotOverlay.tsx`): außen ein Element mit `-translate-x-1/2`, innen ein eigenes für die Animation.
Unproblematisch sind Radix-Popper (Menüs, Tooltips): Der Wrapper positioniert, der Inhalt animiert.

## Zusammengezogene Dialoge: kein flex-1 im h-fit-Dialog
Gemeldet 2026-10-31: Dialoge waren gestaucht, der Inhalt musste in einem schmalen Streifen gescrollt werden. Die Meldung sagte „auf max“, gelesen als „auf Mac“; das ist nicht bestätigt und nicht auf einem echten Mac geprüft.

Ursache: In WebKit 17.4 fällt ein `flex: 1 1 0%` direkt in einem `position: fixed` + `height: fit-content`-Elternteil auf null zusammen, es bleibt nur das Padding (32 px). WebKit 27.2 und Chromium verhalten sich richtig, unter Windows war es deshalb nie zu sehen. Gemessen: nur genau diese Kombination fällt zusammen, nicht `max-h` ohne `h-fit`, nicht `static`.

Regel: Der Dialog-Körper hat `flex-auto min-h-0`, nicht `flex-1`. Verschachteltes `flex-1` darunter ist unkritisch, weil der Körper dann eine Höhe aus dem Inhalt hat.

## macOS-WebKit unter Windows nachstellen
Playwright bringt WebKit auch für Windows mit, und alte Playwright-Versionen bringen altes WebKit: `playwright@1.40.1` liefert WebKit 17.4, die aktuelle Version 27.2. In einem eigenen Temp-Ordner installieren, `userAgent` auf Macintosh setzen und gegen den Vite-Dev-Server (Port 1420) messen. Die echte App läuft mit einem gestubbten `__TAURI_INTERNALS__` (`sidecar_status` true, `sidecar_send` antwortet über den Listener von `sidecar://messages`). Das ist nicht derselbe Build wie WKWebView auf dem Mac, die Layout-Engine aber schon.
