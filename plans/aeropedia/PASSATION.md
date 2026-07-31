# AEROPEDIA — passation de session

**Dernière mise à jour : 31 juillet 2026, en cours de session (checkpoint d'urgence,
quota utilisateur presque épuisé).** Point d'entrée unique pour reprendre le travail.

## 1. Ce qu'on fait

Nouvelle encyclopédie rétro `docs/aeropedia/` ("AEROPEDIA"), consacrée à des avions
d'exception, dans le **même style visuel exact** que `docs/conquete-spatiale/`
(NEW HORIZON). 15 pages prévues, une par avion, + `index.html`.

Liste des 15 avions demandés par l'utilisateur (dans l'ordre chronologique choisi,
voir `plans/aeropedia/nav.py` → `ORDRE`) :
Handley Page Victor, Leduc 02 (0.21/0.22), Canberra PR.9, U-2, Bell X-2, F-100D,
X-15, WB-57, XB-70 Valkyrie, SR-71 Blackbird, Tu-160, Tacit Blue (YF-117D),
B-1B Lancer, X-31, YF-118G (Bird of Prey).

Consignes utilisateur : un maximum d'informations réelles (recherche via skill
**mach2**), images Wikimedia Commons (vérifiées HTTP 200) avec l'effet "rétro
pixelisé" hérité de `image-rendering: pixelated` sur `<body>` (PAS un filtre CSS à
inventer — c'est déjà le mécanisme utilisé par New Horizon), éviter les schémas
SVG (l'auteur ne les maîtrise pas bien), liens croisés façon Wikipédia entre les
pages de l'encyclopédie. Nom de marque choisi par l'utilisateur : **AEROPEDIA**.

## 2. Le cahier des charges complet est déjà écrit

**Lire `plans/aeropedia/GABARIT.md` en premier** : structure HTML exacte, bloc
menu à recopier tel quel, table des liens précédent/suivant par page, classes
CSS disponibles, méthode de recherche mach2, méthode de vérification des images
Wikimedia (curl HTTP 200, espacer les requêtes de 2-3 s pour éviter les 429),
clarifications de désignation (Leduc 02, Tacit Blue/YF-117D, YF-118G).

**Page canonique déjà écrite et complète : `docs/aeropedia/sr71.html`** — gabarit
structurel concret à copier (bandeau, menu, sommaire, sections numérotées,
fiches techniques, encadrés, alertes, galerie, sources, nav-pages, pied).

## 3. État d'avancement — VÉRIFIER L'ÉTAT RÉEL DU DISQUE AVANT TOUTE ACTION

Au moment de ce checkpoint, `docs/aeropedia/` contient :
- `style.css` ✅ (copie de New Horizon, adaptée)
- `sr71.html` ✅ (page canonique, terminée)
- `victor.html` ✅ (écrit par un agent en tâche de fond)
- `u2.html` ✅ (écrit par un agent en tâche de fond)
- `b1b.html` ✅ (écrit par un agent en tâche de fond)
- `x31.html` ✅ (écrit par un agent en tâche de fond)

**7 agents ont été lancés en parallèle en tâche de fond** (background), chacun
chargé de 2 pages, avec un prompt complet et autonome (contexte + instructions
de recherche + consignes de style) référençant `GABARIT.md` et `sr71.html`.
Ces agents sont **propres à la session Claude Code qui les a lancés** : s'ils
n'ont pas fini d'écrire leurs fichiers au moment où cette session se termine,
il faut considérer leur travail comme perdu pour les pages non encore présentes
sur le disque, et **relancer une recherche + rédaction pour les fichiers
manquants** (le prompt à réutiliser est visible plus bas, un par binôme).

Binômes lancés (fichier attendu → statut à vérifier avec `ls docs/aeropedia/`) :
1. `victor.html` + `x2.html` — victor.html confirmé écrit, vérifier x2.html
2. `leduc.html` + `pr9.html` — vérifier les deux
3. `u2.html` + `f100d.html` — u2.html confirmé écrit, vérifier f100d.html
4. `x15.html` + `wb57.html` — vérifier les deux
5. `xb70.html` + `tu160.html` — vérifier les deux
6. `tacit-blue.html` + `yf118g.html` — vérifier les deux
7. `b1b.html` + `x31.html` — les deux confirmés écrits (binôme terminé)

**Pour reprendre : commencer par `ls docs/aeropedia/*.html` pour voir l'état réel,
puis pour chaque fichier manquant, relancer un agent (ou le faire soi-même) avec
un prompt du même type que ceux utilisés initialement** — cf. le message de
lancement dans l'historique de conversation si disponible, sinon reconstituer à
partir de `GABARIT.md` (qui contient toutes les instructions détaillées avion par
avion dans sa section "Notes de contenu spécifiques par avion", plus les faits
de recherche déjà glanés pour Victor, Leduc, Tacit Blue, YF-118G, WB-57 cités
dans les prompts originaux — voir historique).

## 4. Une fois les 15 pages + index.html toutes présentes

1. `python plans/aeropedia/nav.py` — régénère le menu et les nav-pages sur toutes
   les pages, met à jour le compteur du pied de page. **Ne PAS lancer avant que
   toutes les pages existent** (sinon le menu perd les liens vers les pages
   absentes).
2. `python plans/aeropedia/verif.py` — contrôle liens morts, menu identique
   partout, classes CSS toutes définies, compteur de pied cohérent. Corriger
   tout problème signalé.
3. Écrire `docs/aeropedia/index.html` (n'existe pas encore) : bandeau, menu,
   plan du site en cartes `.carte` groupées par les 3 époques (voir
   `docs/conquete-spatiale/index.html` comme modèle de structure), stats
   `.stat-ligne`, section sources et méthode. Voir tâche #5 du suivi de session.
4. Vérifier qu'aucune page ne référence un fichier absent (le `<div class="menu">`
   pointe vers `index.html` en premier lien — s'assurer qu'il existe).

## 5. Ordre chronologique de référence (déjà encodé dans nav.py)

victor(1952) → leduc(1953) → pr9(1955) → u2(1955) → x2(1955) → f100d(1956)
→ x15(1959) → wb57(1963) → xb70(1964) → sr71(1964) → tu160(1981)
→ tacit-blue(1982) → b1b(1984) → x31(1990) → yf118g(1996)

## 6. Points de vigilance

- Le menu est dupliqué en dur dans chaque page — toujours viser la cohérence
  avec `nav.py`.
- `docs/` est la racine publiée par GitHub Pages ; les scripts restent dans
  `plans/`.
- Aucun commit ni push n'a été fait à ce stade — c'est un chantier en cours,
  uniquement en local.
- Rien n'a encore été demandé côté commit/push par l'utilisateur : ne pas
  committer sans qu'il le demande explicitement.
