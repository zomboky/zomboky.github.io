'use strict';

// Zones comparées. Attention : le HLB (Huanglongbing) est endémique au
// Brésil mais absent d'Espagne/UE (confirmé par l'EPPO) — les zones
// espagnoles ne sont donc PAS comparées au même risque HLB que le Brésil,
// mais suivent une logique de biosécurité (surveillance du vecteur Trioza
// erytreae, et du CTV qui lui est endémique). Voir README.md.

function centroidOf(bbox) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };
}

const RAW_REGIONS = [
  {
    id: 'brazil_cinturao',
    name: 'Cinturão Citrícola (São Paulo / Triângulo Mineiro, Brésil)',
    country: 'BR',
    kind: 'endemic_disease',
    colorSlot: 1,
    diseaseContext:
      'HLB endémique : incidence passée de 24 % (2022) à environ 44-47 % des arbres (2024-2025) selon Fundecitrus.',
    referenceUrl: 'https://www.fundecitrus.com.br/pes/pesquisar/',
    bbox: [-50.5, -23.0, -47.0, -19.3],
  },
  {
    id: 'spain_valencia',
    name: 'Comunidad Valenciana (Espagne)',
    country: 'ES',
    kind: 'biosecurity_watch',
    colorSlot: 2,
    diseaseContext:
      'Pas de HLB confirmé (EPPO). CTV endémique depuis 1957. Environ 56 % de la surface agrumicole espagnole.',
    referenceUrl: 'https://portalagrari.gva.es/es/agricultura/plagas-con-medidas-especiales-de-control',
    bbox: [-0.8, 38.3, 0.3, 40.3],
  },
  {
    id: 'spain_murcia',
    name: 'Región de Murcia (Espagne)',
    country: 'ES',
    kind: 'biosecurity_watch',
    colorSlot: 3,
    diseaseContext: 'Pas de HLB confirmé. CTV endémique. Deuxième bassin de production.',
    referenceUrl: 'https://gd.eppo.int/taxon/TRIZER',
    bbox: [-1.7, 37.5, -0.7, 38.3],
  },
  {
    id: 'spain_andalucia',
    name: 'Vallée du Guadalquivir (Andalousie, Espagne)',
    country: 'ES',
    kind: 'biosecurity_watch',
    colorSlot: 4,
    diseaseContext: 'Pas de HLB confirmé. CTV endémique. Environ 27 % de la surface agrumicole espagnole.',
    referenceUrl: 'https://gd.eppo.int/taxon/TRIZER',
    bbox: [-6.5, 37.0, -4.8, 38.2],
  },
  {
    id: 'spain_galicia_vector_front',
    name: 'Front du vecteur (Galice / côte atlantique)',
    country: 'ES',
    kind: 'vector_front',
    colorSlot: 5,
    diseaseContext:
      "Pas une zone de production d'agrumes : Trioza erytreae (psylle vecteur du HLB) y est établie depuis 2014 et se propage vers l'est (Asturies, Cantabrie, Pays basque).",
    referenceUrl: 'https://www.gbif.org/species/5153544',
    bbox: [-9.3, 41.8, -7.0, 43.8],
  },
];

const REGIONS = Object.fromEntries(
  RAW_REGIONS.map((r) => [r.id, { ...r, centroid: centroidOf(r.bbox) }])
);

module.exports = { REGIONS };
