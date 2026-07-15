---
name: push-version
description: Commit and push the current changes to GitHub with an automatic, incrementing version number in the commit message and as a git tag (e.g. hibou-3d-1.3). Use when the user asks to "push", "publish", "commit et push", "envoie sur github", or otherwise wants the working tree shipped with a version bump for one of this repo's mini-projects (hibou-3d, hibou-et-nid, space, etc).
---

# Push avec versionnage automatique

Ce skill commit et pousse les changements en cours sur GitHub, en attribuant
automatiquement un numéro de version incrémenté au projet concerné (ex:
`hibou-3d-1.2` → `hibou-3d-1.3` → `hibou-3d-1.4` ...).

## Convention de version

- Chaque mini-projet du repo (fichier sous `docs/`, ex: `hibou-3d.html`,
  `hibou-et-nid.html`) a son propre compteur de version, au format
  `<projet>-MAJOR.MINOR` (ex: `hibou-3d-1.2`).
- La source de vérité pour "quelle est la version actuelle" est la liste des
  tags git : `git tag --list "<projet>-*" | sort -V | tail -1`.
- Baseline connue au 2026-07-01 : `hibou-3d-1.2` (pas encore taguée en base —
  si aucun tag `hibou-3d-*` n'existe, considérer que la version actuelle est
  `1.2` et que le prochain commit devient `1.3`).
- Par défaut, chaque exécution du skill incrémente le MINOR de 0.1
  (`X.Y` → `X.(Y+1)`). N'incrémente le MAJOR que si l'utilisateur le demande
  explicitement (changement de version majeure/breaking).

## Étapes

1. **Identifier le projet concerné.**
   - Si l'utilisateur précise un nom de projet, l'utiliser.
   - Sinon, l'inférer depuis les fichiers modifiés (`git status`) : le nom de
     base du fichier principal sous `docs/` (ex: `docs/hibou-3d.html` →
     projet `hibou-3d`).

2. **Déterminer la version actuelle et la prochaine version.**
   - Lancer `git tag --list "<projet>-*" | sort -V | tail -1`.
   - Si un tag existe (ex: `hibou-3d-1.2`), la prochaine version est
     `hibou-3d-1.3`.
   - Si aucun tag n'existe, utiliser la baseline connue ci-dessus pour ce
     projet, ou demander à l'utilisateur si le projet est inconnu.

3. **Committer.**
   - Stager les fichiers pertinents (ceux du projet concerné, pas de
     `git add -A` aveugle sur tout le repo).
   - Message de commit court, au format :
     `Update <fichier> <projet>-<version> — <résumé bref des changements>`
     (voir le style des commits existants du repo pour le ton, ex:
     `Update hibou-et-nid.html v4.6`).

4. **Taguer.**
   - Créer un tag léger sur ce commit : `git tag <projet>-<version>`.

5. **Pousser.**
   - `git push origin <branche-courante>`
   - `git push origin <projet>-<version>` (pousser le tag)

6. **Confirmer** à l'utilisateur la version publiée et le lien du commit/tag.

## Garde-fous

- Ce skill pousse vers `origin` (dépôt public GitHub Pages de l'utilisateur).
  Le fait d'invoquer ce skill vaut autorisation du push pour cette
  invocation — ne pas redemander confirmation à chaque fois qu'il est
  explicitement invoqué. En revanche, si les changements n'ont pas encore
  été testés/validés dans le navigateur et que ce n'est pas évident d'après
  la conversation, le signaler avant de pousser.
- Ne jamais utiliser `--force` sur le push.
- Ne pas committer de fichiers non liés au projet concerné.


