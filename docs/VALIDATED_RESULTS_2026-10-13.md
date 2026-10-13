# Résultats vérifiés — 2026-10-13

Source: GitHub Actions run 38472327612, artifact 11852391116, strategy-comparison.json.

Données: 720 bougies closes 4h par paire XBTEUR, ETHEUR, SOLEUR, du 2026-06-15 20:00 UTC au 2026-10-13 16:00 UTC. Split 338 bougies entraînement, 182 validation après warmup 200.

| Stratégie | Train net % | Validation net % | Validation max DD % | Trades validation |
|---|---:|---:|---:|---:|
| SMA20/50 | +0.633 | -1.246 | -2.776 | 24 |
| SMA50/200 | -2.396 | +0.039 | -3.048 | 29 |
| Momentum20 | +0.231 | -2.187 | -4.785 | 46 |
| SMA20/50 + momentum | +0.636 | -1.324 | -2.908 | 26 |

Frais simulés 0.8 % par transaction, slippage 0.1 %. Validation redémarre à 1000 EUR, positions initiales nulles; résultats de train/validation non chaînés.

Décision: AUCUNE stratégie promue en production. SMA50/200 est marginalement positive sur validation, mais négative en entraînement; aucune preuve de robustesse. Comparateur exploratoire, échantillon court, aucun test multi-années.

Amélioration suivante: référence passive 25% crypto avec coûts ajoutée au comparateur (commit 39072af), résultat en attente de la prochaine exécution. Vérifier les biais d'exécution, le modèle des frais, les signaux historiques et le comportement des expositions avant toute proposition de modification du Worker.

Sécurité: executionEnabled=false, aucune API privée, aucune modification des paramètres de risque ni du Worker Cloudflare.
