# F1 Live (Expo, TypeScript)

Live F1-updates via de gratis OpenF1 API. Tabs: Klassement, Teamradio, Wedstrijdleiding (UI Nederlands).

## Starten
    npm install
    npx expo start --tunnel
Scan de QR met de iPhone-camera (Expo Go geinstalleerd) of open de exp://...exp.direct URL in Expo Go.

## Testen
- npx tsc --noEmit
- npx tsx scripts/smoke.ts  (parse-test tegen een afgelopen race)

## Opmerkingen
- Gratis OpenF1-data loopt achter; 429 rate limit wordt met retry afgehandeld.
- intervals bestaat alleen in races; in training/kwalificatie toont het klassement snelste ronde en delta.
