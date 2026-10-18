# Kraken Control MVP

Expo / React Native iPhone dashboard for the Kraken paper-trading system.

## Staging endpoint
- Worker: `kraken-control-staging`
- URL: `https://kraken-control-staging.trevisranguin.workers.dev`
- Health: `/health` (public, no secret data)
- API: `/api/status`, `/api/chat`, `/api/repair/preview` (bearer token required)
- Dedicated KV: `kraken-control-staging-data` (`e6bd3ec212d841ad8d1e187de0395072`)

## Safety
- Paper mode only. No real orders, withdrawals, or live-execution toggle.
- Separate staging Worker and KV; production Worker and production KV are untouched.
- Diagnostics read only. Repair endpoint only returns a preview and never mutates KV or D1.
- The AI has no tools and cannot execute actions.
- The app never contains Kraken credentials, the control token, or Cloudflare API tokens.

## Mobile setup
Requires Node.js LTS.

```sh
npm install
npx expo start
```

The app defaults to the staging URL. Override it with `EXPO_PUBLIC_API_BASE_URL` if needed. Never put privileged credentials in `EXPO_PUBLIC_*` variables; they are bundled into the app.

## Worker secrets
- `CONTROL_TOKEN`: generated random bearer token, configured as a Cloudflare Worker secret.
- `OPENAI_API_KEY`: optional, server-side only. Without it, chat uses a safe diagnostic fallback.

## Validation
- Worker tests and TypeScript checks passed in GitHub Actions on commit `5e7f9990de168fe8194d88e3c06d30922509b59b`.
- Staging Worker deployed with dedicated KV and a server-side control token.
- Production bot unchanged. No live trading, withdrawals, or production writes.
- iOS EAS build still requires an authenticated Expo/EAS project session.
