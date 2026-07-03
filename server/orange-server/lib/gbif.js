'use strict';

// Occurrences de Trioza erytreae (psylle vecteur du HLB) via l'API
// publique GBIF. taxonKey=5153544 -> https://www.gbif.org/species/5153544
// Licence CC BY-NC 4.0 : usage non commercial uniquement, garder
// l'attribution GBIF visible côté site.

const TAXON_KEY = 5153544;

async function fetchTriozaOccurrences() {
  const url = `https://api.gbif.org/v1/occurrence/search?taxonKey=${TAXON_KEY}&country=ES&hasCoordinate=true&limit=300`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GBIF a répondu ${res.status}`);
  const json = await res.json();
  const points = json.results
    .filter((r) => r.decimalLatitude != null && r.decimalLongitude != null)
    .map((r) => ({
      lat: r.decimalLatitude,
      lon: r.decimalLongitude,
      date: r.eventDate || (r.year ? String(r.year) : null),
      basis: r.basisOfRecord,
    }));

  return {
    species: 'Trioza erytreae',
    taxonKey: TAXON_KEY,
    source: 'GBIF.org',
    sourceUrl: 'https://www.gbif.org/species/5153544',
    license: 'CC BY-NC 4.0',
    fetchedAt: new Date().toISOString(),
    count: points.length,
    points,
  };
}

module.exports = { fetchTriozaOccurrences, TAXON_KEY };
