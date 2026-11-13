# Are They a Honeypot?

https://aretheyahoneypot.com — upload a photo of anyone (or anything) and a cartoon wheel confirms they are a spy. Satire.

- The photo is handled only in the browser (object URL + canvas). The only API write is `POST /api/verdict` with no body, which bumps a real counter in D1.
- `src/wheel.ts` holds the pure wheel geometry. Half the wheel is reassuring (PROBABLY FINE, NOT A SPY…) and half is spy; `tests/wheel.test.ts` proves every spin and flick still lands on a spy wedge. The first verdict lands directly; every other second opinion stalls on PROBABLY FINE first.
- The Wheel Intelligence Agency (WIA) is the voice of all copy. The pixel-art agents in `src/sprites.ts` are original drawings.
- The favicon is the investigator emoji as SVG text, so each visitor's system emoji font draws it.
- The only third-party script is Cloudflare Web Analytics (cookieless, aggregate), which Cloudflare injects at the edge for this zone; the CSP allows exactly that origin.
- Sounds are synthesized with WebAudio. The mute choice (`ath:muted` in localStorage) is the only browser storage.

## Develop

```sh
npm ci
npm run dev          # build, migrate local D1, wrangler dev on :8790
npm run check        # typecheck, unit tests, build, static copy/URL lint
npm run e2e          # Playwright, desktop + mobile, against a local Worker
npm run assets       # re-render public/og.png, apple-touch-icon.png and the test fixture
```

## Release

Pushing to `main` runs CI; on success the deploy job runs `npm run deploy` (`scripts/release.mjs`): build, apply and verify remote D1 migrations, `wrangler deploy` with `RELEASE_SHA`, then poll `/api/health` until production reports that SHA. The job uses the scoped `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets.
