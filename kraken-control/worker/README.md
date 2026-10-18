# Kraken Control staging Worker

## Deploy only to staging

1. Install Node.js LTS and run `npm install` in this folder.
2. Create a secret token locally (do not commit it): `openssl rand -hex 32`.
3. Set secrets on the staging Worker: `npx wrangler secret put CONTROL_TOKEN` and optionally `npx wrangler secret put OPENAI_API_KEY`.
4. Confirm `wrangler.toml` references the dedicated staging KV namespace, not production.
5. Deploy with `npx wrangler deploy` only after tests pass.
6. Set the iOS app's `EXPO_PUBLIC_API_BASE_URL` to the staging Worker URL. Never put the bearer token or AI key in an Expo public environment variable; enter the control token in the app's session field.

## Guardrails
- This API reads only `paper:checkpoint:v1` and `ops:autonomous-supervisor:last`.
- Repair endpoints only generate a preview; they never write KV, D1, Worker settings, or trading orders.
- The AI has no tools and cannot execute actions.
- Never bind production KV or configure a Kraken trading secret here.

## Tests
`npm test` and `npm run typecheck`.
