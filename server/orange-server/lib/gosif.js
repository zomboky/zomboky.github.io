'use strict';

// Ingestion de la fluorescence solaire induite (SIF) réelle depuis GOSIF
// (Li & Xiao, 2019 — https://doi.org/10.3390/rs11050517), dérivé OCO-2 +
// MODIS + réanalyse, grille globale 0.05°, pas de temps 8 jours.
//
// Remplace TROPOMI/TROPOSIF (S5P) écarté : ce produit s'est arrêté en mars
// 2021 (vérifié sur data-portal.s5p-pal.com) et ne peut donc pas alimenter
// un tableau de bord vivant. GOSIF, lui, continue d'être mis à jour — avec
// un décalage de publication d'environ 1 à 2 ans (dernière extension connue
// : décembre 2024, cf. Fair_Data_Use_Policy_and_Readme_GOSIF_v2.pdf).
//
// Chaque fichier journalier est un GeoTIFF global (~7200x3600 px, Int16,
// scale factor 0.0001, unité W m-2 µm-1 sr-1, valeurs de remplissage 32767
// eau / 32766 neige-glace permanente). L'agrégation par zone se fait via
// GDAL/numpy (scripts/gosif_extract.py) plutôt qu'en JS : pas de lecteur
// GeoTIFF pur JS dans les dépendances existantes, et GDAL est déjà le
// standard de facto pour ce genre d'extraction raster.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');
const fetch = require('node-fetch');

const BASE_URL = 'https://data.globalecology.unh.edu/data/GOSIF_v2/8day/';
const CACHE_DIR = path.join(__dirname, '..', 'data', 'gosif-cache');
const EXTRACT_SCRIPT = path.join(__dirname, '..', 'scripts', 'gosif_extract.py');
const PYTHON_BIN = process.env.GOSIF_PYTHON_BIN || 'python3';

// Grille fixe des 46 périodes de 8 jours par an (dernière période : 5 ou 6
// jours en fin d'année), telle qu'utilisée par le nommage GOSIF_YYYYDDD.
const PERIOD_STARTS = Array.from({ length: 46 }, (_, i) => i * 8 + 1);

function doyToIsoDate(year, doy) {
  const d = new Date(Date.UTC(year, 0, 1));
  d.setUTCDate(d.getUTCDate() + doy - 1);
  return d.toISOString().slice(0, 10);
}

function pad3(n) {
  return String(n).padStart(3, '0');
}

function periodId(year, doy) {
  return `${year}${pad3(doy)}`;
}

function periodsInRange(startIso, endIso) {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  const periods = [];
  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year++) {
    for (const doy of PERIOD_STARTS) {
      const date = doyToIsoDate(year, doy);
      const t = new Date(`${date}T00:00:00Z`);
      if (t >= start && t <= end) periods.push({ year, doy, date });
    }
  }
  return periods;
}

async function urlExists(url) {
  const res = await fetch(url, { method: 'HEAD' });
  return res.ok;
}

// Le jeu de données GOSIF n'est pas mis à jour en temps réel (décalage de
// publication de plusieurs mois à ~2 ans) : on sonde en partant
// d'aujourd'hui vers le passé pour trouver la dernière période réellement
// publiée, plutôt que de supposer une date figée en dur.
async function findLatestAvailablePeriod(maxLookbackPeriods = 140) {
  const today = new Date();
  let year = today.getUTCFullYear();
  let doy = PERIOD_STARTS.filter((d) => doyToIsoDate(year, d) <= today.toISOString().slice(0, 10)).pop();
  if (doy == null) { year -= 1; doy = PERIOD_STARTS[PERIOD_STARTS.length - 1]; }

  for (let i = 0; i < maxLookbackPeriods; i++) {
    const url = `${BASE_URL}GOSIF_${periodId(year, doy)}.tif.gz`;
    if (await urlExists(url)) return { year, doy, date: doyToIsoDate(year, doy) };
    const idx = PERIOD_STARTS.indexOf(doy);
    if (idx > 0) { doy = PERIOD_STARTS[idx - 1]; } else { year -= 1; doy = PERIOD_STARTS[PERIOD_STARTS.length - 1]; }
  }
  return null;
}

async function downloadPeriod(year, doy) {
  const id = periodId(year, doy);
  const tifPath = path.join(CACHE_DIR, `GOSIF_${id}.tif`);
  if (fs.existsSync(tifPath)) return tifPath;

  const url = `${BASE_URL}GOSIF_${id}.tif.gz`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const gz = Buffer.from(await res.arrayBuffer());
  const tif = zlib.gunzipSync(gz);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const tmpPath = tifPath + '.tmp';
  fs.writeFileSync(tmpPath, tif);
  fs.renameSync(tmpPath, tifPath);
  return tifPath;
}

function extractMeans(tifPath, regionsFilePath) {
  const result = spawnSync(PYTHON_BIN, [EXTRACT_SCRIPT, tifPath, regionsFilePath], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`gosif_extract.py a échoué (${PYTHON_BIN}) : ${result.stderr || result.error}`);
  }
  return JSON.parse(result.stdout);
}

function writeRegionsFile(regions) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const filePath = path.join(CACHE_DIR, '_regions.json');
  const payload = regions.map((r) => ({ id: r.id, bbox: r.bbox }));
  fs.writeFileSync(filePath, JSON.stringify(payload));
  return filePath;
}

// regions : tableau de { id, bbox } (zones productrices, pas le front du
// vecteur). monthsBack : profondeur d'historique demandée en amont de la
// dernière période réellement publiée (pas "aujourd'hui" — voir le
// décalage de publication ci-dessus).
async function getSifDashboardData(regions, monthsBack = 36) {
  const latest = await findLatestAvailablePeriod();
  if (!latest) throw new Error('aucune période GOSIF disponible (source injoignable ou format changé)');

  const startDate = new Date(`${latest.date}T00:00:00Z`);
  startDate.setUTCMonth(startDate.getUTCMonth() - monthsBack);
  const periods = periodsInRange(startDate.toISOString().slice(0, 10), latest.date);

  const regionsFilePath = writeRegionsFile(regions);
  const series = Object.fromEntries(regions.map((r) => [r.id, []]));

  for (const period of periods) {
    const tifPath = await downloadPeriod(period.year, period.doy);
    if (!tifPath) continue; // trou d'acquisition connu (voir README) : on saute la période
    const means = extractMeans(tifPath, regionsFilePath);
    for (const region of regions) {
      const value = means[region.id];
      if (value != null) series[region.id].push({ date: period.date, sif: Number(value.toFixed(4)) });
    }
  }

  return {
    example: false,
    source: 'GOSIF v2 (Li & Xiao, 2019, https://doi.org/10.3390/rs11050517)',
    unit: 'W m-2 µm-1 sr-1 (SIF, moyenne 8 jours par zone)',
    latestAvailableDate: latest.date,
    ingestedAt: new Date().toISOString(),
    note:
      "GOSIF a un décalage de publication d'environ 1 à 2 ans : la série " +
      "s'arrête à la dernière période publiée par UNH, pas à aujourd'hui.",
    series,
  };
}

module.exports = { getSifDashboardData, findLatestAvailablePeriod, periodsInRange, doyToIsoDate };
