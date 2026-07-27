# -*- coding: utf-8 -*-
"""
NEW HORIZON — regenerateur de navigation.

Source unique de verite pour :
  - l'ordre chronologique des pages
  - le bloc <div class="menu"> (duplique a l'identique dans chaque page)
  - le bloc <div class="nav-pages"> (precedent / suivant)
  - le nombre de pages annonce dans le pied de page

Les pages listees dans ORDRE mais absentes du disque sont ignorees : on peut donc
lancer le script a tout moment pendant que les nouvelles pages sont ecrites.

Usage : python nav.py [--check]
"""
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2] / "docs" / "conquete-spatiale"

# (fichier, libelle de menu, epoque)  --- ordre chronologique par date de debut du sujet
ORDRE = [
    ("index.html",           "Accueil",        None),

    ("avant-espace.html",    "Avant l'espace", "I &middot; Avant le spatial (…→1957)"),
    ("pionniers.html",       "Pionniers",      "I &middot; Avant le spatial (…→1957)"),
    ("propulsion.html",      "Propulsion",     "I &middot; Avant le spatial (…→1957)"),
    ("animaux.html",         "Animaux",        "I &middot; Avant le spatial (…→1957)"),
    ("cosmodromes.html",     "Cosmodromes",    "I &middot; Avant le spatial (…→1957)"),

    ("spoutnik.html",        "Spoutnik",       "II &middot; L'ouverture de l'espace (1957→1969)"),
    ("lanceurs.html",        "Lanceurs",       "II &middot; L'ouverture de l'espace (1957→1969)"),
    ("sondes.html",          "Sondes",         "II &middot; L'ouverture de l'espace (1957→1969)"),
    ("militaire.html",       "Militaire",      "II &middot; L'ouverture de l'espace (1957→1969)"),
    ("satellites.html",      "Satellites",     "II &middot; L'ouverture de l'espace (1957→1969)"),
    ("mercury-gemini.html",  "Mercury/Gemini", "II &middot; L'ouverture de l'espace (1957→1969)"),
    ("apollo.html",          "Apollo",         "II &middot; L'ouverture de l'espace (1957→1969)"),
    ("lune-sovietique.html", "Lune URSS",      "II &middot; L'ouverture de l'espace (1957→1969)"),
    ("europe.html",          "Europe",         "II &middot; L'ouverture de l'espace (1957→1969)"),
    ("apesanteur.html",      "Apesanteur",     "II &middot; L'ouverture de l'espace (1957→1969)"),
    ("telescopes.html",      "Télescopes",     "II &middot; L'ouverture de l'espace (1957→1969)"),
    ("debris-droit.html",    "Droit &amp; débris", "II &middot; L'ouverture de l'espace (1957→1969)"),

    ("chine.html",           "Chine",          "III &middot; Stations et navettes (1970→2000)"),
    ("nations.html",         "Nations",        "III &middot; Stations et navettes (1970→2000)"),
    ("stations.html",        "Stations",       "III &middot; Stations et navettes (1970→2000)"),
    ("navettes.html",        "Navettes",       "III &middot; Stations et navettes (1970→2000)"),

    ("newspace.html",        "NewSpace",       "IV &middot; L'espace contemporain (2000→2026)"),
    ("artemis.html",         "Artemis",        "IV &middot; L'espace contemporain (2000→2026)"),

    ("accidents.html",       "Accidents",      "Annexes"),
    ("hommes.html",          "Équipages",      "Annexes"),
    ("donnees.html",         "Données",        "Annexes"),
    ("chronologie.html",     "Chronologie",    "Annexes"),
]

RE_MENU = re.compile(r'<div class="menu">.*?</div>\n', re.S)
RE_NAVPAGES = re.compile(r'<div class="nav-pages">.*?</div>\n', re.S)
RE_PAGES_PIED = re.compile(r'— \d+ pages, 100 % rétro')


def presentes():
    return [(f, lib, ep) for f, lib, ep in ORDRE if (RACINE / f).exists()]


def bloc_menu(courant, pages):
    lignes = ['<div class="menu">']
    epoque_en_cours = object()
    for fichier, libelle, epoque in pages:
        if epoque != epoque_en_cours:
            epoque_en_cours = epoque
            if epoque is not None:
                lignes.append(f'  <span class="menu-ep">{epoque}</span>')
        actif = ' class="actif"' if fichier == courant else ''
        lignes.append(f'  <a{actif} href="{fichier}">{libelle}</a>')
    lignes.append('</div>\n')
    return "\n".join(lignes)


def bloc_nav_pages(index, pages):
    """Precedent / suivant dans l'ordre chronologique."""
    if index == 0:
        prec = '<a href="../index.html">&laquo; Retour à BearServeBeer</a>'
    else:
        f, lib, _ = pages[index - 1]
        prec = f'<a href="{f}">&laquo; {lib}</a>'

    if index == len(pages) - 1:
        suiv = '<a href="index.html">Retour au sommaire &raquo;</a>'
    else:
        f, lib, _ = pages[index + 1]
        suiv = f'<a href="{f}">{lib} &raquo;</a>'

    return f'<div class="nav-pages">\n  {prec}\n  {suiv}\n</div>\n'


def main():
    check = "--check" in sys.argv
    pages = presentes()
    n = len(pages)
    manquantes = [f for f, _, _ in ORDRE if not (RACINE / f).exists()]
    problemes = []

    for i, (fichier, _, _) in enumerate(pages):
        chemin = RACINE / fichier
        src = chemin.read_text(encoding="utf-8")
        out = src

        for regex, remplacement, nom in (
            (RE_MENU, bloc_menu(fichier, pages), "menu"),
            (RE_NAVPAGES, bloc_nav_pages(i, pages), "nav-pages"),
            (RE_PAGES_PIED, f"— {n} pages, 100 % rétro", "pied"),
        ):
            out, k = regex.subn(lambda _m, r=remplacement: r, out, count=1)
            if k == 0:
                problemes.append(f"{fichier}: bloc {nom} introuvable")

        if out != src:
            if check:
                problemes.append(f"{fichier}: navigation desynchronisee")
            else:
                chemin.write_text(out, encoding="utf-8")
                print(f"  maj  {fichier}")

    print(f"\n{n} pages dans l'ordre chronologique.")
    if manquantes:
        print(f"pas encore ecrites ({len(manquantes)}) : {', '.join(manquantes)}")
    if problemes:
        print("\nPROBLEMES :")
        for p in problemes:
            print("  ! " + p)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
