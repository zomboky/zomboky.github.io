# -*- coding: utf-8 -*-
"""
AEROPEDIA — regenerateur de navigation.

Copie conforme du script equivalent de NEW HORIZON (plans/new-horizon/nav.py),
adaptee au dossier docs/aeropedia et a la liste des avions.

Source unique de verite pour :
  - l'ordre chronologique des pages (par date de premier vol du modele traite)
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

RACINE = Path(__file__).resolve().parents[2] / "docs" / "aeropedia"

# (fichier, libelle de menu, epoque) --- ordre chronologique par date de premier vol
ORDRE = [
    ("index.html",       "Accueil",         None),

    ("victor.html",      "Handley Page Victor", "I &middot; Pionniers du mur du son (1952→1956)"),
    ("leduc.html",       "Leduc 02",         "I &middot; Pionniers du mur du son (1952→1956)"),
    ("pr9.html",         "Canberra PR.9",    "I &middot; Pionniers du mur du son (1952→1956)"),
    ("u2.html",          "U-2",              "I &middot; Pionniers du mur du son (1952→1956)"),
    ("x2.html",          "Bell X-2",         "I &middot; Pionniers du mur du son (1952→1956)"),
    ("f100d.html",       "F-100D",           "I &middot; Pionniers du mur du son (1952→1956)"),

    ("x15.html",         "X-15",             "II &middot; L'ère hypersonique (1959→1964)"),
    ("wb57.html",        "WB-57",            "II &middot; L'ère hypersonique (1959→1964)"),
    ("xb70.html",        "XB-70 Valkyrie",   "II &middot; L'ère hypersonique (1959→1964)"),
    ("sr71.html",        "SR-71 Blackbird",  "II &middot; L'ère hypersonique (1959→1964)"),

    ("tu160.html",       "Tu-160",           "III &middot; Guerre froide tardive et furtivité (1981→1996)"),
    ("tacit-blue.html",  "Tacit Blue",       "III &middot; Guerre froide tardive et furtivité (1981→1996)"),
    ("b1b.html",         "B-1B Lancer",      "III &middot; Guerre froide tardive et furtivité (1981→1996)"),
    ("x31.html",         "X-31",             "III &middot; Guerre froide tardive et furtivité (1981→1996)"),
    ("yf118g.html",      "YF-118G",          "III &middot; Guerre froide tardive et furtivité (1981→1996)"),
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
        prec = '<a href="../index.html">&laquo; Retour a BearServeBeer</a>'
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
