# Are They a Honeypot?

https://aretheyahoneypot.com — upload a photo of anyone (or anything) and a cartoon wheel confirms they are a spy. Satire.

- The photo is handled only in the browser (object URL + canvas). The only API write is `POST /api/verdict` with no body, which bumps a real counter in D1.
- `src/wheel.ts` holds the pure wheel geometry; `tests/wheel.test.ts` proves every planned spin and flick lands inside a `SPY` wedge.
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

Pushing to `main` runs CI; on success the deploy job runs `npm run deploy` (`scripts/release.mjs`): build, apply and verify remote D1 migrations, `wrangler deploy` with `RELEASE_SHA`, then poll `/api/health` until production reports that SHA. The job uses the scoped `CLOUDFLARE_API_TOKEN` repository secret and the `CLOUDFLARE_ACCOUNT_ID` variable.
