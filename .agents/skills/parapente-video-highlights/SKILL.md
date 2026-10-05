---
name: parapente-video-highlights
description: Génère des vidéos courtes de meilleurs moments à partir de vidéos panoramiques de vols en parapente. Utiliser lorsqu'il faut analyser des fichiers pano.mp4, sélectionner des scènes, choisir un cadrage 360° et produire un export conservant le format d'origine.
---

# Parapente Video Highlights

Ce skill transforme une ou plusieurs vidéos panoramiques de vols en un montage social court, en conservant les fichiers sources et en produisant des sorties vérifiables.

## Entrées par défaut

- Racine des vols : `/media/nas/DS211_Synology_2/parapente`
- Vidéos sources : `YYYYMMDD/NN/pano.mp4`
- Sorties : un sous-dossier `highlights/` près de la source, sauf demande contraire.

Accepter aussi un fichier ou un dossier explicitement fourni par l'utilisateur. Ne jamais analyser les dossiers `@eaDir`, `.tmp`, `.logs` ou les fichiers déjà exportés.

## Workflow

1. Recenser les vidéos et lire leur durée, résolution, codec et fréquence d'images avec `ffprobe`.
2. Pour chaque vidéo, échantillonner des fenêtres candidates de 5 à 15 secondes. Privilégier les changements de scène, le mouvement lisible, la visibilité du pilote/de la voile, les paysages dégagés et les séquences de décollage, virage ou atterrissage.
3. Générer des projections rectilinéaires candidates en conservant le rapport largeur/hauteur d’origine de la vidéo pano, avec plusieurs angles horizontaux et un horizon stable. Ne jamais publier directement la projection équirectangulaire.
4. Évaluer les candidats selon qualité d'image, intérêt du vol, visibilité du sujet, beauté du paysage, mouvement de caméra et diversité. Écarter flou, obstruction, horizon très incliné et doublons.
5. Produire un montage de 15 à 45 secondes, sauf durée demandée. Garder au moins 2 secondes de contexte autour d'un événement important quand la source le permet.
6. Exporter en MP4 H.264/AAC, en conservant le rapport largeur/hauteur de la vidéo source, avec audio conservé lorsque sa qualité est acceptable.
7. Fournir un rapport JSON avec les scènes retenues, leurs timestamps, leur angle, leur score et les chemins des exports.

## Règles de décision

- Pour une vidéo longue, répartir les scènes dans le vol au lieu de prendre uniquement la fin.
- Préférer la diversité : décollage, action, paysage et conclusion plutôt que plusieurs plans similaires.
- Le cadrage doit suivre le sujet sans mouvements brusques et garder l'horizon dans le tiers supérieur ou central.
- Si la sélection automatique est incertaine, générer une planche de prévisualisation et demander une validation avant un rendu lourd.
- Ne jamais écraser une source ni supprimer un export existant sans confirmation.

## Outil

Utiliser `scripts/generate_highlights.py` pour préparer les candidats et rendre les extraits validés. Lire son aide avant utilisation :

```bash
python .agents/skills/parapente-video-highlights/scripts/generate_highlights.py --help
```

Pour une première validation, traiter un seul vol court, puis seulement ensuite les vidéos longues ou en 7680×3840.
