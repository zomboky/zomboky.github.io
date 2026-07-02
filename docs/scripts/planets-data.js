// Données partagées des planètes : plages de scroll (%), positions du texte
// et infos affichées. Utilisé à la fois par planet-text.js (affichage du nom
// et du cartouche) et par space.js (position de la caméra), pour garantir
// que le nom affiché correspond toujours à la planète réellement visible.
export const planets = [
    {
        name: "Neptune", start: 0, end: 7, pos: { top: "10%", left: "50%" },
        cartouchePos: { top: "50%", left: "75%" },
        data: {
            masse: "102",
            diametre: "49528",
            gravite: "11.0",
            liberation: "23.5",
            rotation: "16.1",
            distance: "4495100000"
        }
    },
    {
        name: "Uranus", start: 10, end: 12.8, pos: { top: "20%", left: "50%" },
        cartouchePos: { top: "50%", left: "75%" },
        data: {
            masse: "86.8",
            diametre: "51118",
            gravite: "8.7",
            liberation: "21.3",
            rotation: "-17.2",
            distance: "2872500000"
        }
    },
    {
        name: "Saturne", start: 14.63, end: 20, pos: { top: "15%", left: "50%" },
        cartouchePos: { top: "50%", left: "75%" },
        data: {
            masse: "568",
            diametre: "120536",
            gravite: "9.0",
            liberation: "35.5",
            rotation: "10.7",
            distance: "1433500000"
        }
    },
    {
        name: "Jupiter", start: 22.31, end: 30.42, pos: { top: "10%", left: "60%" },
        cartouchePos: { top: "50%", left: "75%" },
        data: {
            masse: "1898",
            diametre: "142984",
            gravite: "23.1",
            liberation: "59.5",
            rotation: "9.9",
            distance: "778600000"
        }
    },
    {
        name: "Mars", start: 32, end: 40.65, pos: { top: "20%", left: "40%" },
        cartouchePos: { top: "50%", left: "30%" },
        data: {
            masse: "0.642",
            diametre: "6792",
            gravite: "3.7",
            liberation: "5.0",
            rotation: "24.6",
            distance: "227900000"
        }
    },
    {
        name: "Terre", start: 43.50, end: 52, pos: { top: "10%", left: "50%" },
        cartouchePos: { top: "50%", left: "80%" },
        data: {
            masse: "5.97",
            diametre: "12756",
            gravite: "9.8",
            liberation: "11.2",
            rotation: "23.9",
            distance: "149600000"
        }
    },
    {
        name: "Vénus", start: 54, end: 58, pos: { top: "25%", left: "30%" },
        cartouchePos: { top: "45%", left: "30%" },
        data: {
            masse: "4.87",
            diametre: "12104",
            gravite: "8.9",
            liberation: "10.4",
            rotation: "-5832.5",
            distance: "108200000"
        }
    },
    {
        name: "Mercure", start: 61.4, end: 70, pos: { top: "30%", left: "65%" },
        cartouchePos: { top: "50%", left: "70%" },
        data: {
            masse: "0.330",
            diametre: "4879",
            gravite: "3.7",
            liberation: "4.3",
            rotation: "1407.6",
            distance: "57900000"
        }
    }
];
