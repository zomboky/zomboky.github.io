console.log("planet-text.js chargé");

const infoBox = document.getElementById("planet-info");

// Planètes et leurs plages de scroll (%)
const planets = [
    { name: "Neptune", start: 0, end: 7, pos: { top: "10%", left: "50%" }},
    { name: " ", start: 7, end: 10 },
    { name: "Uranus", start: 10, end: 12.8, pos: { top: "20%", left: "50%" }},
    { name: " ", start: 12.8, end: 14.63 },
    { name: "Saturne", start: 14.63, end: 20, pos: { top: "15%", left: "50%" }},
    { name: " ", start: 20, end: 22.31 },
    { name: "Jupiter", start: 22.31, end: 30.42, pos: { top: "10%", left: "60%" }},
    { name: " ", start: 30.42, end: 32 },
    { name: "Mars", start: 32, end: 40.65, pos: { top: "20%", left: "40%" }},
    { name: " ", start: 40.65, end: 43.50 },
    { name: "Terre", start: 43.50, end: 52, pos: { top: "10%", left: "50%" }},
    { name: " ", start: 52, end: 54 },
    { name: "Vénus", start: 54, end: 58, pos: { top: "25%", left: "60%" }},
    { name: " ", start: 58, end: 61.4 },
    { name: "Mercure", start: 61.4, end: 70, pos: { top: "10%", left: "65%" }},
    { name: " ", start: 70, end: 100 },
];

function updatePlanetText() {
    const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
    
    //Affichage du pourcentage de scroll debug 
    //document.getElementById("scroll-info").textContent = scrollPercent + "%";

    // Trouve la planète active
    const planet = planets.find(p => scrollPercent >= p.start && scrollPercent < p.end);

    // Partie pour le centrage du texte 

    if (planet) {
        infoBox.textContent = planet.name;
        infoBox.style.top = planet.pos.top;
        infoBox.style.left = planet.pos.left;
        infoBox.style.transform = "translate(-50%, -50%)"; // garde le centrage relatif
    }
}

window.addEventListener("scroll", updatePlanetText);
updatePlanetText(); // appel initial
