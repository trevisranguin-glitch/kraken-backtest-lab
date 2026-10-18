# Kraken Control MVP

Expo / React Native iPhone dashboard for the Kraken paper-trading system.

## Safety
- Paper mode only. No real orders, withdrawals, or live-execution toggle.
- The app never contains Kraken credentials or Cloudflare API tokens.
- Diagnostics are read-only. Repair preview is non-mutating.
- Use a separate staging Worker and KV namespace. Do not connect production until tests pass.

## Mobile setup
Requires Node.js LTS.

```sh
npm install
npx expo start
```

Set `EXPO_PUBLIC_API_BASE_URL` to the staging API URL. Never place privileged credentials in `EXPO_PUBLIC_*` variables; they are bundled into the app.

## Staging API secrets
- `CONTROL_TOKEN`: long random bearer token.
- `OPENAI_API_KEY`: optional, server-side only.

Bind a dedicated test KV namespace as `DATA`. The worker only exposes safe status, diagnostic chat, and repair-plan preview routes.

## Validation
1. Typecheck app and run worker tests.
2. Test with synthetic KV fixtures and a staging token.
3. Confirm invalid tokens return 401 and no secrets are returned.
4. Confirm repair preview does not mutate KV or D1.
5. Deploy a separate staging Worker only after review.

The known production supervisor bug and audit integration gap remain separate fixes; this MVP does not change production.