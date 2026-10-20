# Kraken Control MVP

Expo / React Native iPhone dashboard for the Kraken paper-trading system.

## Staging endpoint
- Worker: 'kraken-control-staging'
- URL: 'https://kraken-control-staging.trevisranguin.workers.dev'
- Health: '/health' (public, no secret data)
- API: '/api/status', '/api/chat', '/api/repair/preview' (bearer token required)
- Dedicated KV: 'kraken-control-staging-data' ('e6bd3ec212d841ad8d1e187de0395072')

## Token handling
- The bearer control token is entered once in Settings; the app restores it on later launches where storage persists.
- Native app: uses `expo-secure-store` (device secure storage).
- Web: uses `sessionStorage`, limited to the current browser tab session; it is not a server-side credential and is cleared when that session ends.
- The token is never compiled into `EXPO_PUBLIC_*`, source code, or the chat log. Use only the staging control token.
- First-time sign-in still requires a token. Fully automatic identity-based sign-in requires a separate authenticated login layer; never expose the server secret to make setup appear automatic.

## Safety
- Paper mode only. No real orders, withdrawals, or live-execution toggle.
- Separate staging Worker and KV; production Worker and production KV are untouched.
- Diagnostics read only. Repair endpoint only returns a preview and never mutates KV or D1.
- The AI has no tools and cannot execute actions.
- The app never contains Kraken credentials, the control token, or Cloudflare API tokens.

## Mobile development
Requires Node.js LTS.

```sh
cd kraken-control
npm ci
npx expo start
```

The app defaults to the staging URL. Override it with 'EXPO_PUBLIC_API_BASE_URL' if needed. Never put privileged credentials in 'EXPO_PUBLIC_*' variables; they are bundled into the app.

## Prepare an iOS EAS build
1. On a trusted computer, open a terminal in 'kraken-control'.
2. Sign in to Expo: 'npx eas-cli@latest login'.
3. Link/create the EAS project: 'npx eas-cli@latest init'. Review and commit the generated 'extra.eas.projectId' in 'app.json'.
4. Create an Expo access token in your Expo account settings. In GitHub, open **Settings → Secrets and variables → Actions**, create repository secret 'EXPO_TOKEN', and paste the token there. Do not put the token in source code or chat.
5. The workflow **Kraken Control iOS Build** can be run manually from GitHub Actions after that workflow exists on the repository's default branch. Select 'preview' for an internal test build.
6. A physical-device internal iOS build may require Apple Developer signing credentials and device registration. EAS will report any missing requirement.

The build workflow checks the Expo token, verifies that the project is linked, runs Expo Doctor, then requests the selected iOS build from EAS.

## Worker secrets
- 'CONTROL_TOKEN': generated random bearer token, configured as a Cloudflare Worker secret.
- 'OPENAI_API_KEY': optional, server-side only. Without it, chat uses a safe diagnostic fallback.

## Validation
- Cloudflare Pages build pipeline now runs `npm run typecheck` before `npm run web:build` to catch TypeScript errors before deployment.
- Worker tests, Worker TypeScript checks, mobile TypeScript, Expo Doctor, and the staging health check passed in GitHub Actions on commit 'b61e58729c9e710967d53518cc9b1e293bbde533'.
- Staging Worker deployed with dedicated KV and a server-side control token.
- Production bot unchanged. No live trading, withdrawals, or production writes.
- The iOS binary has not been built yet; EAS project linking, Expo authentication, and Apple signing/device requirements must be completed first.
