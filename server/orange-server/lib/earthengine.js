'use strict';

const fs = require('fs');
const ee = require('@google/earthengine');

let readyPromise = null;

function initEarthEngine(keyPath = process.env.GEE_KEY_PATH) {
  if (readyPromise) return readyPromise;
  readyPromise = new Promise((resolve, reject) => {
    if (!keyPath || !fs.existsSync(keyPath)) {
      reject(new Error(`Clé de service Earth Engine introuvable (GEE_KEY_PATH=${keyPath})`));
      return;
    }
    const privateKey = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    ee.data.authenticateViaPrivateKey(
      privateKey,
      () => ee.initialize(null, null, resolve, reject),
      reject
    );
  });
  return readyPromise;
}

function regionGeometry(region) {
  const [minLon, minLat, maxLon, maxLat] = region.bbox;
  return ee.Geometry.Rectangle([minLon, minLat, maxLon, maxLat]);
}

// Masquage nuages/ombres via la bande SCL (Scene Classification Layer),
// plus robuste que QA60 dont le remplissage est devenu incohérent sur
// certaines tuiles depuis le changement de baseline de traitement ESA
// (2022). Classes exclues : 3 = ombre de nuage, 8/9 = nuage moyen/haute
// probabilité, 10 = cirrus fin, 11 = neige.
function maskS2clouds(image) {
  const scl = image.select('SCL');
  const clear = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10)).and(scl.neq(11));
  return image.updateMask(clear);
}

function addIndices(image) {
  const ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  const ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
  const ndmi = image.normalizedDifference(['B8', 'B11']).rename('NDMI');
  // EVI n'est PAS scale-invariant (constantes 6/7.5/1) : contrairement aux
  // indices normalisés ci-dessus, il faut repasser en réflectance 0-1
  // avant de l'appliquer.
  const evi = image
    .expression('2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
      NIR: image.select('B8').divide(10000),
      RED: image.select('B4').divide(10000),
      BLUE: image.select('B2').divide(10000),
    })
    .rename('EVI');
  return image.addBands([ndvi, ndwi, ndmi, evi]);
}

async function getTimeseries(region, start, end) {
  const geometry = regionGeometry(region);
  const bands = ['NDVI', 'EVI', 'NDWI', 'NDMI'];

  const collection = ee
    .ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geometry)
    .filterDate(start, end)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 60))
    .map(maskS2clouds)
    .map(addIndices);

  // scale=200m (au lieu des 10m natifs) : ce tableau de bord agrège par
  // grande zone, pas par parcelle — largement suffisant et beaucoup plus
  // rapide pour reduceRegion sur des polygones de la taille d'une province.
  const featureCollection = collection.map((image) => {
    const stats = image.select(bands).reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry,
      scale: 200,
      maxPixels: 1e9,
      bestEffort: true,
    });
    return ee.Feature(null, stats.set('date', image.date().format('YYYY-MM-dd')));
  });

  const info = await new Promise((resolve, reject) => {
    featureCollection.getInfo((result, error) => (error ? reject(new Error(error)) : resolve(result)));
  });

  return info.features
    .map((f) => f.properties)
    .filter((p) => bands.every((b) => typeof p[b] === 'number'))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

module.exports = { initEarthEngine, regionGeometry, maskS2clouds, addIndices, getTimeseries };
