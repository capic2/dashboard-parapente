---
target: $impeccable critique apps/frontend/src/pages/Dashboard.tsx
total_score: 25
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
target_identity: "file:/media/usb/data-m2/developement/dashboard-parapente/apps/frontend/src/pages/Dashboard.tsx"
target_fingerprint: "sha256:ee5d77e157d242093b5320eeb9c263f25d5fd33abe625ac8c9553690268b3e5e"
target_path: /media/usb/data-m2/developement/dashboard-parapente/apps/frontend/src/pages/Dashboard.tsx
timestamp: 2026-10-04T02-58-08Z
slug: apps-frontend-src-pages-dashboard-tsx
---
# Critique de conception — Dashboard

Method: dual-agent (A: /root/critique_review_a · B: /root/critique_evidence_b)

## Santé de conception

| # | Heuristique | Score / 4 | Point principal |
|---|---|---:|---|
| 1 | Visibilité de l’état du système | 3 | Chargement et erreurs présents; échec de la recommandation difficile à distinguer d’un calcul en cours. |
| 2 | Correspondance avec le monde réel | 3 | Les notions de site et de vol sont adaptées; « Para-Index » et « créneau volable » manquent d’explication. |
| 3 | Contrôle et liberté | 2 | Navigation et actualisation existent, mais pas de contrôle de l’ordre du tableau de bord. |
| 4 | Cohérence et standards | 3 | Composants partagés utiles, avec quelques variations de styles de contrôles. |
| 5 | Prévention des erreurs | 2 | Les verdicts peuvent sembler être une consigne de sécurité. |
| 6 | Reconnaissance plutôt que mémorisation | 3 | Informations principales visibles; les choix horaires mobiles sont moins faciles à découvrir. |
| 7 | Flexibilité et efficacité | 2 | Pas de raccourcis ni de mode compact; la recommandation est précédée des statistiques historiques. |
| 8 | Esthétique et minimalisme | 3 | Présentation claire, mais plusieurs blocs se disputent l’attention. |
| 9 | Récupération après erreur | 3 | Des relances existent pour certains chargements; l’échec de la recommandation est moins explicite. |
| 10 | Aide et documentation | 1 | Le Para-Index n’est pas défini sur l’écran de décision. |
| **Total** |  | **25/40** | **Acceptable — des améliorations importantes sont nécessaires.** |

## Verdict de spécificité

Le tableau de bord a une structure propre au produit : météo quotidienne, recommandation de site et d’horaire, Para-Index et historique des vols partagent le même espace. Mais sa composition — grand bandeau dégradé, cartes arrondies et grille de statistiques — reste proche d’un tableau de bord météo générique. Les mesures spécifiques au parapente dans les cartes de sites et recommandations apportent la meilleure signature produit (`Dashboard.tsx:132–192`, `AllSitesConditions.tsx:86–160`, `BestSpotSuggestion.tsx:319–475`).

**Détecteur :** aucune anomalie signalée; la commande s’est terminée avec le code 0 et sans sortie. Aucun faux positif. Le détecteur n’a pas fourni de JSON sérialisé malgré l’option `--json`.

**Inspection visuelle :** impossible dans cette session, car aucun fournisseur de navigateur n’était disponible. Le serveur local a été lancé pour préparer cette inspection, puis arrêté; aucun overlay n’a été injecté.

## Impression générale

La page rassemble utilement la météo et le suivi des vols, mais ne répond pas assez vite à la question centrale du pilote : « Où et quand voler aujourd’hui? » Le plus grand potentiel est de placer la recommandation quotidienne au premier plan tout en la présentant comme une aide à la décision, pas comme un feu vert de sécurité.

## Ce qui fonctionne

- La météo et les vols personnels sont réunis dans un même parcours (`Dashboard.tsx:169–191`).
- Les cartes de sites rendent la comparaison concrète avec le site, le verdict, la température, le vent et l’heure des données (`AllSitesConditions.tsx:56–164`).
- Plusieurs chargements et erreurs ont un état visible, avec des relances ou des squelettes (`Dashboard.tsx:86–129,197–217`).

## Problèmes prioritaires

1. **[P1] Nuancer les recommandations de vol.** « Excellent » ou « créneau volable » peut être interprété comme un feu vert, alors que les garanties de sécurité ou de précision ne sont pas établies. Ajouter près du verdict une précision concise sur les conditions et l’incertitude; éviter toute formulation qui promet un vol sûr. `BestSpotSuggestion.tsx:337–340,424–445`; `AllSitesConditions.tsx:88–104`. **Commande suggérée :** `$impeccable clarify`.
2. **[P1] Rendre les choix horaires compréhensibles au lecteur d’écran.** Les boutons horaires remplacent leur nom accessible par le seul nom du site. Pour un même site, l’heure et les prévisions deviennent indiscernables. Inclure heure, site, score, verdict et vent dans le nom accessible, ou exposer une table sémantique sur toutes les tailles d’écran. `BestSpotSuggestion.tsx:544–553,597–604`. **Commande suggérée :** `$impeccable harden`.
3. **[P2] Donner une issue claire quand la recommandation échoue.** En l’absence de résultat, l’écran peut rester sur « calcul en cours » sans distinguer une attente d’une erreur ni proposer de relance. Transmettre l’état de la requête et fournir un état d’attente borné avec diagnostic et récupération. `BestSpotSuggestion.tsx:227–269`; requête dans `Dashboard.tsx:36–47`. **Commande suggérée :** `$impeccable harden`.
4. **[P2] Présenter la décision du jour avant les statistiques historiques.** La page affiche les huit statistiques avant la recommandation de meilleur site, ce qui ralentit l’accès à la tâche principale et surcharge le premier balayage. Placer la recommandation avant les statistiques et réduire le résumé initial à quelques indicateurs, avec le reste révélé au besoin. `Dashboard.tsx:169–190`; `StatsPanel.tsx:130–203`. **Commande suggérée :** `$impeccable distill`.

## Signaux par persona

- **Alex, pilote expérimenté :** doit parcourir huit statistiques historiques avant d’atteindre la recommandation météo; aucun raccourci clavier, mode compact ou réorganisation du tableau de bord n’est visible.
- **Sam, navigation accessible :** les choix horaires n’annoncent que le nom du site, pas l’heure ni les mesures; les icônes météo masquées aux technologies d’assistance laissent certains chiffres sans libellé explicite (`AllSitesConditions.tsx:107–155`).
- **Casey, usage mobile :** les grilles s’adaptent, mais la page et les choix horaires peuvent s’étirer ou défiler horizontalement; aucun retour rapide depuis le bas de page n’est évident. La taille réelle des cibles tactiles n’a pas pu être vérifiée visuellement.

Aucune persona propre au projet n’a été ajoutée : `apps/frontend/AGENTS.md` ne contient pas de section `Design Context`.

## Observations mineures

- Le badge de date dépend du contexte du titre pour faire comprendre qu’il s’agit d’aujourd’hui (`Dashboard.tsx:49–57,152–157`).
- L’erreur de chargement des sites reste générique malgré la possibilité de relancer (`Dashboard.tsx:90–103`).
- Les lignes météo présentent des icônes suivies de valeurs sans libellé textuel pour chaque mesure (`AllSitesConditions.tsx:107–155`).

## Questions à considérer

- Le pilote doit-il voir d’abord où voler aujourd’hui, ou ses statistiques de vol cumulées?
- Comment le Para-Index peut-il faciliter la comparaison sans ressembler à un verdict de sécurité?
- Quels créneaux horaires méritent d’être mis en avant plutôt que de présenter jusqu’à 24 choix à parcourir?
