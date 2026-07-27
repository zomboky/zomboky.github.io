#!/usr/bin/env python3
"""Assemblage des pages de l'encyclopédie NEW HORIZON.

Chaque page finale (../<slug>.html) est produite à partir du fragment
<slug>.part.html, qui ne contient que le bloc <div class="contenu">...</div>.
L'en-tête, la barre de navigation et le pied de page sont générés ici afin de
rester rigoureusement identiques sur les 19 pages.

Usage :  python3 build.py [slug ...]      (sans argument : tout reconstruit)
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, os.pardir))

# slug, libellé du menu, titre <title>, description meta
PAGES = [
    ("index", "Accueil", "NEW HORIZON — L'encyclopédie de la conquête spatiale",
     "Histoire complète et détaillée de la conquête spatiale, de Tsiolkovski à Artemis : toutes les nations, tous les lanceurs, toutes les missions."),
    ("pionniers", "Pionniers", "Les pionniers de l'astronautique — NEW HORIZON",
     "De la poudre noire chinoise à Peenemünde : Tsiolkovski, Goddard, Oberth, Esnault-Pelterie, von Braun, le V-2 et l'opération Paperclip."),
    ("spoutnik", "Spoutnik", "Spoutnik et les premiers pas soviétiques — NEW HORIZON",
     "Korolev, la R-7, Spoutnik 1 et 2, Laïka, Vostok, Gagarine, Terechkova, Voskhod et la première sortie extravéhiculaire."),
    ("mercury-gemini", "Mercury/Gemini", "Explorer, Mercury et Gemini — NEW HORIZON",
     "La riposte américaine : Vanguard, Explorer 1, la NASA, le programme Mercury, les Sept, et Gemini, école du rendez-vous orbital."),
    ("apollo", "Apollo", "Le programme Apollo — NEW HORIZON",
     "Saturn V, module lunaire, rendez-vous en orbite lunaire, Apollo 1 à 17 : le récit complet et les données techniques du programme lunaire américain."),
    ("lune-sovietique", "Lune URSS", "Le programme lunaire soviétique — NEW HORIZON",
     "N1-L3, Zond, Luna, Lunokhod : la course à la Lune vue de Moscou, ses quatre explosions et ses succès automatiques."),
    ("stations", "Stations", "Les stations spatiales — NEW HORIZON",
     "Saliout, Almaz, Skylab, Apollo-Soyouz, Mir, la Station spatiale internationale, Tiangong et les stations commerciales."),
    ("navettes", "Navettes", "Navettes et avions-fusées — NEW HORIZON",
     "X-15, Dyna-Soar, Space Shuttle, Bourane, Hermès, X-37B et les capsules du XXIe siècle."),
    ("lanceurs", "Lanceurs", "Les lanceurs du monde — NEW HORIZON",
     "Toutes les familles de fusées orbitales, de la R-7 au Starship : masses, poussées, ergols, fiabilité et schémas comparatifs."),
    ("sondes", "Sondes", "L'exploration robotique du système solaire — NEW HORIZON",
     "Luna, Mariner, Venera, Viking, Pioneer, Voyager, Galileo, Cassini, Rosetta, New Horizons, les rovers martiens et les retours d'échantillons."),
    ("europe", "Europe", "L'Europe spatiale — NEW HORIZON",
     "Véronique, Diamant, Europa, la naissance de l'ESA, Ariane 1 à 6, Vega, l'ATV, Columbus et les astronautes européens."),
    ("chine", "Chine", "La Chine spatiale — NEW HORIZON",
     "Qian Xuesen, Longue Marche, Shenzhou, Chang'e, Tianwen, Tiangong et le programme lunaire habité chinois."),
    ("nations", "Nations", "Les autres nations spatiales — NEW HORIZON",
     "Japon, Inde, Israël, Iran, Corée du Nord et du Sud, Brésil, Australie, Ukraine, Canada, Émirats : les puissances spatiales secondaires."),
    ("newspace", "NewSpace", "Le NewSpace — NEW HORIZON",
     "SpaceX, Blue Origin, Rocket Lab, constellations, réutilisation, tourisme spatial et micro-lanceurs."),
    ("artemis", "Artemis", "Le retour vers la Lune et Mars — NEW HORIZON",
     "Constellation, SLS, Orion, Artemis I et II, Gateway, les accords Artemis, l'ILRS et les architectures martiennes."),
    ("accidents", "Accidents", "Accidents et catastrophes spatiales — NEW HORIZON",
     "Nedelin, Apollo 1, Soyouz 1 et 11, Challenger, Columbia : les drames de l'astronautique et ce qu'ils ont changé."),
    ("hommes", "Équipages", "Les équipages — NEW HORIZON",
     "Statistiques des vols habités, records de durée, sorties extravéhiculaires, femmes dans l'espace et vie à bord."),
    ("donnees", "Données", "Données techniques et mécanique orbitale — NEW HORIZON",
     "Équation de Tsiolkovski, budgets de delta-v, impulsions spécifiques, ergols, bases de lancement et tableaux comparatifs."),
    ("chronologie", "Chronologie", "Chronologie de la conquête spatiale — NEW HORIZON",
     "De 1232 à 2026, année par année : tous les premiers, tous les records, toutes les nations."),
]

SLUGS = [p[0] for p in PAGES]

MARQUEE = ("★ BIENVENUE DANS LE CENTRE DE CONTRÔLE ★ 324 lancements orbitaux en 2025, record absolu "
           "★ Artemis II a emmené 4 astronautes autour de la Lune le 1<sup>er</sup> avril 2026 "
           "★ 700+ humains ont volé dans l'espace depuis Gagarine ★ Voyager 1 est à plus de 25 milliards de km "
           "★ Bonne visite !")

HEAD = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="shortcut icon" type="image/x-icon" href="https://raw.githubusercontent.com/zomboky/zomboky.github.io/master/docs/assets/icons/ours.png">
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="page">

<div class="bandeau">
  <h1>NEW <span class="rouge">HORIZON</span></h1>
  <p class="sous-titre">L'encyclopédie de la conquête spatiale &middot; 1232 &rarr; 2026 &middot; toutes les nations</p>
  <div class="filets"></div>
</div>

<div class="menu">
{menu}
</div>

<div class="bandeau-defilant">
  <marquee behavior="scroll" direction="left" scrollamount="4">
    {marquee}
  </marquee>
</div>

<div class="ariane">Vous êtes ici : <a href="index.html">Accueil</a>{ariane}</div>

"""

FOOT = """
<div class="pied">
  NEW HORIZON — encyclopédie de la conquête spatiale<br>
  <span class="maj">Dernière mise à jour : juillet 2026</span> — 19 pages, 100 % rétro, 0 % cookie<br>
  Images : NASA / ESA / Roscosmos / JAXA / CNSA via Wikimedia Commons — domaine public ou licences libres<br>
  <a href="../index.html">Accueil du site</a> · <a href="index.html">Sommaire</a> · <a href="chronologie.html">Chronologie</a> · <a href="donnees.html">Données techniques</a>
</div>

</div><!-- /page -->
<script src="../scripts/visitor-counter.js"></script>
</body>
</html>
"""


def menu_html(current):
    out = []
    for slug, label, _t, _d in PAGES:
        cls = ' class="actif"' if slug == current else ""
        out.append('  <a{cls} href="{slug}.html">{label}</a>'.format(cls=cls, slug=slug, label=label))
    return "\n".join(out)


def build(slug):
    idx = SLUGS.index(slug)
    _s, label, title, desc = PAGES[idx]
    frag_path = os.path.join(HERE, slug + ".part.html")
    with open(frag_path, encoding="utf-8") as f:
        content = f.read().rstrip() + "\n"

    ariane = "" if slug == "index" else ' &rsaquo; <b>{}</b>'.format(label)
    head = HEAD.format(title=title, desc=desc, menu=menu_html(slug),
                       marquee=MARQUEE, ariane=ariane)

    # navigation précédent / suivant, injectée avant la fermeture du contenu
    prev_link = next_link = ""
    if idx > 0:
        prev_link = '<a href="{}.html">&laquo; {}</a>'.format(PAGES[idx - 1][0], PAGES[idx - 1][1])
    else:
        prev_link = '<a href="../index.html">&laquo; Retour à BearServeBeer</a>'
    if idx < len(PAGES) - 1:
        next_link = '<a href="{}.html">{} &raquo;</a>'.format(PAGES[idx + 1][0], PAGES[idx + 1][1])
    else:
        next_link = '<a href="index.html">Retour au sommaire &raquo;</a>'

    nav = ('\n<div class="nav-pages">\n  {}\n  {}\n</div>\n'.format(prev_link, next_link))
    if "<!-- NAVPAGES -->" in content:
        content = content.replace("<!-- NAVPAGES -->", nav)
    else:
        content = re.sub(r"</div><!-- /contenu -->\s*$", nav + "\n</div><!-- /contenu -->\n", content)

    with open(os.path.join(OUT, slug + ".html"), "w", encoding="utf-8") as f:
        f.write(head + content + FOOT)
    return slug


if __name__ == "__main__":
    targets = sys.argv[1:] or SLUGS
    done = []
    for s in targets:
        if s not in SLUGS:
            print("slug inconnu :", s)
            continue
        if not os.path.exists(os.path.join(HERE, s + ".part.html")):
            print("fragment manquant :", s)
            continue
        done.append(build(s))
    print("pages générées :", ", ".join(done) if done else "(aucune)")
