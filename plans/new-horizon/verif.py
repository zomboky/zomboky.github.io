# -*- coding: utf-8 -*-
"""
NEW HORIZON — controles d'integrite.

1. liens relatifs : toute cible locale doit exister (et l'ancre #id aussi)
2. menu : bloc identique partout (au class="actif" pres), un seul actif par page
3. classes : aucune classe utilisee dans le HTML ne doit manquer de style.css
4. pied de page : nombre de pages annonce == nombre reel

Usage : python verif.py
"""
import re
import sys
from collections import Counter
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2] / "docs" / "conquete-spatiale"

RE_HREF = re.compile(r'href="([^"]+)"')
RE_SRC = re.compile(r'<(?:img|script)[^>]+src="([^"]+)"')
RE_CLASS = re.compile(r'class="([^"]+)"')
RE_ID = re.compile(r'\sid="([^"]+)"')
RE_MENU = re.compile(r'<div class="menu">.*?</div>', re.S)
RE_ACTIF = re.compile(r'\s*class="actif"')
RE_PIED = re.compile(r'— (\d+) pages, 100 % rétro')

# classes portees par du SVG ou injectees par JS, sans regle CSS attendue
TOLEREES = {"actif"}

erreurs = []
pages = sorted(RACINE.glob("*.html"))
css = (RACINE / "style.css").read_text(encoding="utf-8")
classes_css = set(re.findall(r'\.([A-Za-z][\w-]*)', css))

ancres = {}
for p in pages:
    ancres[p.name] = set(RE_ID.findall(p.read_text(encoding="utf-8")))

menus = {}
for p in pages:
    src = p.read_text(encoding="utf-8")

    # --- 1. liens et ressources locales
    for cible in RE_HREF.findall(src) + RE_SRC.findall(src):
        if cible.startswith(("http://", "https://", "mailto:", "data:")):
            continue
        if cible.startswith("#"):
            if cible[1:] not in ancres[p.name]:
                erreurs.append(f"{p.name}: ancre morte {cible}")
            continue
        fichier, _, ancre = cible.partition("#")
        chemin = (RACINE / fichier).resolve()
        if not chemin.exists():
            erreurs.append(f"{p.name}: lien mort -> {cible}")
        elif ancre and chemin.name in ancres and ancre not in ancres[chemin.name]:
            erreurs.append(f"{p.name}: ancre morte -> {cible}")

    # --- 2. menu
    m = RE_MENU.search(src)
    if not m:
        erreurs.append(f"{p.name}: bloc menu absent")
    else:
        bloc = m.group(0)
        menus[p.name] = RE_ACTIF.sub("", bloc)
        n_actif = len(RE_ACTIF.findall(bloc))
        if n_actif != 1:
            erreurs.append(f"{p.name}: {n_actif} liens actifs dans le menu (attendu 1)")
        elif f'class="actif" href="{p.name}"' not in bloc:
            erreurs.append(f"{p.name}: le lien actif ne pointe pas sur la page courante")

    # --- 3. classes inconnues
    for attr in RE_CLASS.findall(src):
        for cl in attr.split():
            if cl not in classes_css and cl not in TOLEREES:
                erreurs.append(f"{p.name}: classe sans style -> .{cl}")

    # --- 4. compteur de pages
    mp = RE_PIED.search(src)
    if not mp:
        erreurs.append(f"{p.name}: pied de page sans compteur de pages")
    elif int(mp.group(1)) != len(pages):
        erreurs.append(f"{p.name}: pied annonce {mp.group(1)} pages, il y en a {len(pages)}")

variantes = Counter(menus.values())
if len(variantes) > 1:
    erreurs.append(f"menu : {len(variantes)} variantes differentes au lieu d'une seule")
    for nom, bloc in menus.items():
        if variantes[bloc] < max(variantes.values()):
            erreurs.append(f"   divergent : {nom}")

print(f"{len(pages)} pages controlees.")
if erreurs:
    print(f"\n{len(erreurs)} PROBLEME(S) :")
    for e in dict.fromkeys(erreurs):
        print("  ! " + e)
    sys.exit(1)
print("OK — liens, menu, classes et compteur coherents.")
