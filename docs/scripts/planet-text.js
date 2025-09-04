console.log("planet-text.js chargé");

const infoBox = document.getElementById("planet-info");

// Planètes et leurs plages de scroll (%)
const planets = [
    { name: "Neptune", start: 0, end: 7 },
    {name : " ", start : 7, end : 10},
    { name: "Uranus", start: 10, end: 14.6 },
    {name : " ", start : 14.6, end : 16.4},
    { name: "Saturne", start: 16.4, end: 23 },
    {name : " ", start : 23, end : 25.4},
    { name: "Jupiter", start: 25.4, end: 33 },
    {name : " ", start : 33, end : 36},
    { name: "Mars", start: 36, end: 48 },
    {name : " ", start : 48, end : 49.67},
    { name: "Terre", start: 49.67, end: 60 },
    {name : " ", start : 60, end : 62},
    { name: "Vénus", start: 62, end: 67.7 },
    {name : " ", start : 67.7, end : 70},
    { name: "Mercure", start: 70, end: 80 },
    {name : " ", start : 80, end : 100},
];

function updatePlanetText() {
    const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
    console.log("Scroll :", scrollPercent + "%");

    // Cherche la planète correspondant à la plage de scroll
    const planet = planets.find(p => scrollPercent >= p.start && scrollPercent < p.end);

    if (planet) {
    infoBox.textContent = planet.name;
    }
}

window.addEventListener("scroll", updatePlanetText);
updatePlanetText(); // appel initial
