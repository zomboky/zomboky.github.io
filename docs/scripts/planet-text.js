import { planets } from './planets-data.js';

const infoBox = document.getElementById("planet-info");
const dataBox = document.getElementById("planet-data");

function updatePlanetText() {
    const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
    
    //Affichage du pourcentage de scroll debug 
    //document.getElementById("scroll-info").textContent = scrollPercent + "%";

    // Trouve la planète active
    const planet = planets.find(p => scrollPercent >= p.start && scrollPercent < p.end);

    // Partie pour le centrage du nom de la planète 

    if (planet) {
        infoBox.textContent = planet.name;
        infoBox.style.top = planet.pos.top;
        infoBox.style.left = planet.pos.left;
        infoBox.style.transform = "translate(-50%, -50%)"; // garde le centrage relatif


                // Cartouche
        dataBox.innerHTML = `
            <h3>${planet.name}</h3>
            <div>Masse : ${planet.data.masse} ×10^24 kg</div>
            <div>Diamètre : ${planet.data.diametre} km</div>
            <div>Gravité : ${planet.data.gravite} m/s²</div>
            <div>Vitesse d’évasion : ${planet.data.liberation} km/s</div>
            <div>Rotation : ${planet.data.rotation} h</div>
            <div>Distance au Soleil : ${planet.data.distance} km</div>
        `;

            // Positionnement du cartouche en x et y
        dataBox.style.top = planet.cartouchePos.top;
        dataBox.style.left = planet.cartouchePos.left;
        dataBox.style.transform = "translate(-50%, -50%)"; // garde le centrage

    }
    
}

window.addEventListener("scroll", updatePlanetText);
updatePlanetText(); // appel initial
