# KRAKEN — mémoire technique GitHub (2026-10-13)

## Sources étudiées (références, pas dépendances installées)

| Projet | URL | Licence GitHub | Application potentielle |
|---|---|---|---|
| Freqtrade | https://github.com/freqtrade/freqtrade | GPL-3.0 | Backtesting, hyperoptimisation, lookahead-analysis, dry-run |
| Hummingbot | https://github.com/hummingbot/hummingbot | Apache-2.0 | Architecture des connecteurs, gestion des ordres et surveillance |
| CCXT | https://github.com/ccxt/ccxt | MIT | Adaptateurs de données multi-exchanges et limites de débit |
| python-kraken-sdk | https://github.com/btschwertfeger/python-kraken-sdk | Apache-2.0 | Kraken Spot REST/WebSocket, exceptions, reconnexions |
| python3-krakenex | https://github.com/veox/python3-krakenex | LGPL-3.0 | Client REST léger, gestion de la signature privée (NON requise ici) |
| Jesse | https://github.com/jesse-ai/jesse | MIT | Séparation entraînement/validation, backtest et métriques |

Ce document conserve des pistes techniques; il ne prétend pas que le code de ces dépôts a été audité intégralement. Ne pas recopier du code sans vérifier sa licence et ses dépendances.

## Observations vérifiées
- GitHub Actions de recherche a terminé avec succès au lancement initial (run 38471348701).
- Le dépôt de recherche est actuellement PUBLIC. Aucun secret, token ou donnée sensible n'y est autorisé.
- Le collecteur lit uniquement Kraken public OHLC 4h et exclut la bougie inachevée.
- La simulation de recherche ne représente pas exactement le Worker Cloudflare.
- Le collecteur Kraken OHLC est limité à l'historique récent; l'optimisation sur ce seul échantillon est fragile.

## Hypothèses à tester
1. Une stratégie à rotation plus faible peut réduire l'impact des frais de 0,8 %.
2. Un filtre de tendance SMA50/200 peut réduire les faux signaux mais risque de manquer des hausses.
3. Des filtres de volatilité/liquidité peuvent aider, sans garantie de rentabilité.
4. Les performances doivent être mesurées sur des segments chronologiques séparés, avec comparateur buy-and-hold.

## Principes de sécurité
- Recherche séparée de la production. executionEnabled=false.
- Ne pas utiliser de secrets GitHub ni appeler les API Kraken privées.
- Ne pas modifier les paramètres de risque ni le Cron Cloudflare.
- Pas de promotion en production sans tests hors échantillon, revue des coûts et validation humaine.

## Plan priorisé
P0: Tests unitaires synthétiques pour prévenir le lookahead et les erreurs de calcul.
P1: Rapport comparatif multi-stratégies, frais/slippage et buy-and-hold.
P2: Walk-forward chronologique, qualité et couverture des données.
P3: Audit du code réel du Worker et rapprochement des signaux.
P4: Monitoring des erreurs Kraken/Cloudflare, sans automatisation d'ordres réels.

## Journal
2026-10-13: Inventaire de six projets GitHub publics et création de cette mémoire technique. Aucune stratégie déclarée gagnante.
