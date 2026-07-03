(function () {
  'use strict';

  const DATA_URL = 'data/orange-disease/dashboard.json';
  const COLOR_VAR = { 1: '--series-1', 2: '--series-2', 3: '--series-3', 4: '--series-4', 5: '--series-5' };
  const svgNS = 'http://www.w3.org/2000/svg';

  const state = {
    dashboard: null,
    weights: { ndvi: 0.4, ndmi: 0.4, sif: 0.2 },
    smoothingWeeks: 4,
    recentWeeks: 8,
    alertThreshold: 1.5,
    dateRangeMonths: 24,
    activeRegions: new Set(['brazil_cinturao', 'spain_valencia', 'spain_murcia', 'spain_andalucia']),
  };

  function $(id) { return document.getElementById(id); }
  function cssVar(name) { return getComputedStyle(document.querySelector('.od-root') || document.body).getPropertyValue(name).trim(); }
  function dayMs(d) { return new Date(d + 'T00:00:00Z').getTime(); }
  function fmt2(v) { return v.toFixed(2); }
  function fmt3(v) { return v.toFixed(3); }

  // ---------------------------------------------------------------------
  // Chargement des données
  // ---------------------------------------------------------------------

  async function loadDashboard() {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`dashboard.json : HTTP ${res.status}`);
    return res.json();
  }

  function regionColor(regionId) {
    const region = state.dashboard.regions[regionId];
    const varName = COLOR_VAR[region ? region.colorSlot : 1] || '--series-1';
    return cssVar(varName);
  }

  function regionName(regionId) {
    const region = state.dashboard.regions[regionId];
    return region ? region.name : regionId;
  }

  function filterByRange(ts) {
    const end = new Date();
    const start = new Date(end);
    start.setUTCMonth(start.getUTCMonth() - state.dateRangeMonths);
    return (ts || []).filter((p) => {
      const t = new Date(p.date + 'T00:00:00Z');
      return t >= start && t <= end;
    });
  }

  // ---------------------------------------------------------------------
  // Anomalies / score de risque / tendance projetée
  //
  // Méthode : moyenne mobile par fenêtre de dates -> écart-type/moyenne sur
  // la période "de référence" (tout sauf les `recentWeeks` dernières
  // semaines) -> z-score. Le signe est inversé pour NDVI/NDMI/SIF : un
  // z positif signifie "valeur anormalement basse" = signal de stress.
  // C'est une anomalie statistique, pas un diagnostic de maladie confirmé
  // (voir README).
  // ---------------------------------------------------------------------

  function movingAverageByDate(points, key, windowDays) {
    const ms = points.map((p) => dayMs(p.date));
    const half = (windowDays * 86400000) / 2;
    return points.map((_, i) => {
      let sum = 0, n = 0;
      for (let j = 0; j < points.length; j++) {
        if (Math.abs(ms[j] - ms[i]) <= half) { sum += points[j][key]; n++; }
      }
      return n ? sum / n : points[i][key];
    });
  }

  function meanStd(values) {
    const n = values.length;
    if (!n) return { mean: 0, std: 0 };
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(n - 1, 1);
    return { mean, std: Math.sqrt(variance) };
  }

  function riskZSeries(points, key, smoothingWeeks, recentWeeks) {
    if (points.length < 4) return null;
    const smoothed = movingAverageByDate(points, key, smoothingWeeks * 7);
    const cutoff = dayMs(points[points.length - 1].date) - recentWeeks * 7 * 86400000;
    const baseline = [];
    points.forEach((p, i) => { if (dayMs(p.date) < cutoff) baseline.push(smoothed[i]); });
    const { mean, std } = meanStd(baseline.length >= 4 ? baseline : smoothed);
    if (!std) return smoothed.map(() => 0);
    return smoothed.map((v) => -(v - mean) / std);
  }

  function nearestValue(points, dateStr, key, maxDays) {
    const t = dayMs(dateStr);
    let best = null, bestDiff = Infinity;
    for (const p of points) {
      const diff = Math.abs(dayMs(p.date) - t);
      if (diff < bestDiff) { bestDiff = diff; best = p[key]; }
    }
    if (maxDays && bestDiff > maxDays * 86400000) return null;
    return best;
  }

  function linearRegression(xs, ys) {
    const n = xs.length;
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - meanX) * (ys[i] - meanY); den += (xs[i] - meanX) ** 2; }
    const slope = den ? num / den : 0;
    return { slope, intercept: meanY - slope * meanX };
  }

  function compositeRisk(regionId) {
    const ts = filterByRange(state.dashboard.timeseries[regionId]);
    if (ts.length < 4) return null;

    const zNdvi = riskZSeries(ts, 'NDVI', state.smoothingWeeks, state.recentWeeks);
    const zNdmi = riskZSeries(ts, 'NDMI', state.smoothingWeeks, state.recentWeeks);

    const sifRaw = (state.dashboard.sif && state.dashboard.sif.series && state.dashboard.sif.series[regionId]) || [];
    let zSifByDate = null;
    if (sifRaw.length >= 4) {
      const zSif = riskZSeries(sifRaw, 'sif', state.smoothingWeeks, state.recentWeeks);
      zSifByDate = sifRaw.map((p, i) => ({ date: p.date, z: zSif[i] }));
    }

    const w = state.weights;
    const useSif = !!zSifByDate;
    const totalW = w.ndvi + w.ndmi + (useSif ? w.sif : 0);

    return ts.map((p, i) => {
      let sum = (zNdvi ? zNdvi[i] : 0) * w.ndvi + (zNdmi ? zNdmi[i] : 0) * w.ndmi;
      if (useSif) {
        const zv = nearestValue(zSifByDate, p.date, 'z', 45);
        if (zv != null) sum += zv * w.sif;
      }
      return { date: p.date, score: totalW ? sum / totalW : 0 };
    });
  }

  function projectTrend(series, weeksAhead) {
    const recent = series.slice(-Math.max(6, state.recentWeeks));
    if (recent.length < 3) return [];
    const t0 = dayMs(recent[0].date);
    const xs = recent.map((p) => (dayMs(p.date) - t0) / 86400000);
    const ys = recent.map((p) => p.score);
    const { slope, intercept } = linearRegression(xs, ys);
    const lastX = xs[xs.length - 1];
    const lastMs = dayMs(recent[recent.length - 1].date);
    const out = [];
    for (let w = 1; w <= weeksAhead; w++) {
      const x = lastX + w * 7;
      out.push({ date: new Date(lastMs + w * 7 * 86400000).toISOString().slice(0, 10), score: intercept + slope * x });
    }
    return out;
  }

  function riskLevel(score, threshold) {
    if (score < threshold) return 'good';
    if (score < threshold * 1.5) return 'warning';
    if (score < threshold * 2) return 'serious';
    return 'critical';
  }

  const RISK_LABEL = { good: 'Normal', warning: 'À surveiller', serious: 'Anomalie marquée', critical: 'Anomalie forte' };

  // ---------------------------------------------------------------------
  // Rendu SVG (lignes, grille, marqueurs, croisillon + infobulle)
  // ---------------------------------------------------------------------

  function renderLineChart(svgEl, seriesList, opts) {
    opts = opts || {};
    const width = 600, height = 220, marginL = 36, marginR = 10, marginT = 10, marginB = 8;
    const plotW = width - marginL - marginR, plotH = height - marginT - marginB;
    svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svgEl.innerHTML = '';

    const allPoints = seriesList.flatMap((s) => s.points);
    if (!allPoints.length) return null;

    const dates = allPoints.map((p) => dayMs(p.date));
    const values = allPoints.map((p) => p.value);
    const xMin = Math.min(...dates), xMax = Math.max(...dates);
    const yMin0 = Math.min(...values, opts.zeroLine ? 0 : Infinity);
    const yMax0 = Math.max(...values, opts.zeroLine ? 0 : -Infinity);
    const pad = (yMax0 - yMin0) * 0.15 || 0.05;
    const yMin = yMin0 - pad, yMax = yMax0 + pad;

    const xScale = (t) => marginL + ((t - xMin) / (xMax - xMin || 1)) * plotW;
    const yScale = (v) => marginT + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

    for (let i = 0; i <= 3; i++) {
      const v = yMin + (i / 3) * (yMax - yMin);
      const y = yScale(v);
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', marginL); line.setAttribute('x2', width - marginR);
      line.setAttribute('y1', y.toFixed(1)); line.setAttribute('y2', y.toFixed(1));
      line.setAttribute('stroke', cssVar('--gridline'));
      line.setAttribute('stroke-width', '1');
      svgEl.appendChild(line);

      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', 2); text.setAttribute('y', (y + 3).toFixed(1));
      text.setAttribute('font-size', '9'); text.setAttribute('fill', cssVar('--text-muted'));
      text.textContent = (opts.formatValue || fmt2)(v);
      svgEl.appendChild(text);
    }

    if (opts.zeroLine) {
      const y0 = yScale(0);
      const zline = document.createElementNS(svgNS, 'line');
      zline.setAttribute('x1', marginL); zline.setAttribute('x2', width - marginR);
      zline.setAttribute('y1', y0.toFixed(1)); zline.setAttribute('y2', y0.toFixed(1));
      zline.setAttribute('stroke', cssVar('--axis'));
      zline.setAttribute('stroke-width', '1');
      svgEl.appendChild(zline);
    }

    seriesList.forEach((s) => {
      if (s.points.length < 2) return;
      const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(dayMs(p.date)).toFixed(1)} ${yScale(p.value).toFixed(1)}`).join(' ');
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', s.color);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('stroke-linecap', 'round');
      if (s.dashed) path.setAttribute('stroke-dasharray', '5 4');
      svgEl.appendChild(path);

      const last = s.points[s.points.length - 1];
      const cx = xScale(dayMs(last.date)), cy = yScale(last.value);
      const ring = document.createElementNS(svgNS, 'circle');
      ring.setAttribute('cx', cx.toFixed(1)); ring.setAttribute('cy', cy.toFixed(1)); ring.setAttribute('r', '6');
      ring.setAttribute('fill', cssVar('--surface-1'));
      svgEl.appendChild(ring);
      const dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('cx', cx.toFixed(1)); dot.setAttribute('cy', cy.toFixed(1)); dot.setAttribute('r', '4');
      dot.setAttribute('fill', s.color);
      svgEl.appendChild(dot);
    });

    const hairline = document.createElementNS(svgNS, 'line');
    hairline.setAttribute('y1', marginT); hairline.setAttribute('y2', height - marginB);
    hairline.setAttribute('stroke', cssVar('--axis'));
    hairline.setAttribute('stroke-width', '1');
    hairline.setAttribute('visibility', 'hidden');
    svgEl.appendChild(hairline);

    const overlay = document.createElementNS(svgNS, 'rect');
    overlay.setAttribute('x', 0); overlay.setAttribute('y', 0);
    overlay.setAttribute('width', width); overlay.setAttribute('height', height);
    overlay.setAttribute('fill', 'transparent');
    svgEl.appendChild(overlay);

    const tooltipEl = svgEl.parentElement.querySelector('.od-tooltip');
    if (tooltipEl) {
      const handleMove = (clientX) => {
        const rect = svgEl.getBoundingClientRect();
        const scaleX = width / rect.width;
        const xPx = (clientX - rect.left) * scaleX;
        const t = xMin + ((xPx - marginL) / plotW) * (xMax - xMin);
        hairline.setAttribute('x1', xPx.toFixed(1)); hairline.setAttribute('x2', xPx.toFixed(1));
        hairline.setAttribute('visibility', 'visible');

        tooltipEl.innerHTML = '';
        let dateLabel = '';
        seriesList.forEach((s) => {
          if (!s.points.length) return;
          let best = s.points[0], bestDiff = Infinity;
          s.points.forEach((p) => { const diff = Math.abs(dayMs(p.date) - t); if (diff < bestDiff) { bestDiff = diff; best = p; } });
          dateLabel = best.date;
          const row = document.createElement('div');
          row.className = 'od-tooltip-row';
          const key = document.createElement('span'); key.className = 'od-legend-key'; key.style.background = s.color;
          const name = document.createElement('span'); name.className = 'od-tooltip-name'; name.textContent = s.name;
          const value = document.createElement('span'); value.className = 'od-tooltip-value';
          value.textContent = (opts.formatValue || fmt3)(best.value);
          row.append(key, name, value);
          tooltipEl.appendChild(row);
        });
        const dateRow = document.createElement('div');
        dateRow.className = 'od-tooltip-date';
        dateRow.textContent = dateLabel;
        tooltipEl.insertBefore(dateRow, tooltipEl.firstChild);

        const containerRect = svgEl.parentElement.getBoundingClientRect();
        const leftPx = ((xPx / width) * containerRect.width);
        tooltipEl.style.left = `${leftPx}px`;
        tooltipEl.classList.add('is-visible');
      };
      overlay.addEventListener('pointermove', (e) => handleMove(e.clientX));
      overlay.addEventListener('pointerdown', (e) => handleMove(e.clientX));
      overlay.addEventListener('pointerleave', () => {
        hairline.setAttribute('visibility', 'hidden');
        tooltipEl.classList.remove('is-visible');
      });
    }

    return { xScale, yScale, xMin, xMax };
  }

  function renderLegend(container, seriesList) {
    container.innerHTML = '';
    seriesList.forEach((s) => {
      const item = document.createElement('span');
      item.className = 'od-legend-item';
      const key = document.createElement('span'); key.className = 'od-legend-key'; key.style.background = s.color;
      item.appendChild(key);
      item.appendChild(document.createTextNode(s.name));
      container.appendChild(item);
    });
  }

  function activeRegionList() {
    return Array.from(state.activeRegions).filter((id) => state.dashboard.regions[id]);
  }

  // ---------------------------------------------------------------------
  // Panneaux
  // ---------------------------------------------------------------------

  function renderIndexChart(cardId, key, label) {
    const card = $(cardId);
    const svg = card.querySelector('.od-chart-svg');
    const legend = card.querySelector('.od-legend');
    const empty = card.querySelector('.od-empty');

    const seriesList = activeRegionList()
      .map((id) => {
        const points = filterByRange(state.dashboard.timeseries[id]).map((p) => ({ date: p.date, value: p[key] }));
        return { id, name: regionName(id), color: regionColor(id), points };
      })
      .filter((s) => s.points.length);

    if (!seriesList.length) {
      svg.style.display = 'none';
      legend.style.display = 'none';
      empty.style.display = 'block';
      empty.textContent = "Pas encore de données — en attente du premier rafraîchissement automatique.";
      return;
    }
    svg.style.display = 'block';
    legend.style.display = 'flex';
    empty.style.display = 'none';
    renderLineChart(svg, seriesList, { formatValue: fmt2 });
    renderLegend(legend, seriesList);
  }

  function renderSifChart() {
    const card = $('od-card-sif');
    const svg = card.querySelector('.od-chart-svg');
    const legend = card.querySelector('.od-legend');
    const empty = card.querySelector('.od-empty');
    const badge = card.querySelector('.od-badge');

    const sifBlock = state.dashboard.sif;
    if (sifBlock && sifBlock.example) {
      badge.style.display = 'inline-block';
      badge.textContent = 'DONNÉE D’EXEMPLE';
    } else {
      badge.style.display = 'none';
    }

    const seriesList = activeRegionList()
      .map((id) => {
        const raw = (sifBlock && sifBlock.series && sifBlock.series[id]) || [];
        const points = filterByRange(raw.map((p) => ({ date: p.date, sif: p.sif }))).map((p) => ({ date: p.date, value: p.sif }));
        return { id, name: regionName(id), color: regionColor(id), points };
      })
      .filter((s) => s.points.length);

    if (!seriesList.length) {
      svg.style.display = 'none';
      legend.style.display = 'none';
      empty.style.display = 'block';
      empty.textContent = "Pas de donnée de fluorescence disponible pour les zones sélectionnées.";
      return;
    }
    svg.style.display = 'block';
    legend.style.display = 'flex';
    empty.style.display = 'none';
    renderLineChart(svg, seriesList, { formatValue: fmt2 });
    renderLegend(legend, seriesList);
  }

  function renderRiskPanel() {
    const card = $('od-card-risk');
    const svg = card.querySelector('.od-chart-svg');
    const legend = card.querySelector('.od-legend');
    const empty = card.querySelector('.od-empty');
    const tiles = $('od-risk-tiles');
    tiles.innerHTML = '';

    const seriesList = [];
    let anyTile = false;

    activeRegionList().forEach((id) => {
      const series = compositeRisk(id);
      if (!series || series.length < 3) return;
      anyTile = true;
      const color = regionColor(id);
      seriesList.push({ id, name: regionName(id), color, points: series.map((p) => ({ date: p.date, value: p.score })) });

      const projection = projectTrend(series, 6);
      if (projection.length) {
        seriesList.push({ id: id + '_proj', name: `${regionName(id)} (tendance projetée)`, color, dashed: true, points: [series[series.length - 1], ...projection].map((p) => ({ date: p.date, value: p.score })) });
      }

      const last = series[series.length - 1].score;
      const level = riskLevel(last, state.alertThreshold);
      const tile = document.createElement('div');
      tile.className = 'od-risk-tile';
      tile.innerHTML = `
        <div class="od-risk-name">${escapeHtml(regionName(id))}</div>
        <div class="od-risk-value"><span class="od-risk-dot" style="background:var(--status-${level})"></span>${last.toFixed(2)}</div>
        <div class="od-risk-status">${RISK_LABEL[level]}</div>
      `;
      tiles.appendChild(tile);
    });

    if (!anyTile) {
      svg.style.display = 'none';
      legend.style.display = 'none';
      empty.style.display = 'block';
      empty.textContent = "Pas encore assez de données pour calculer un score de risque.";
      return;
    }
    svg.style.display = 'block';
    legend.style.display = 'flex';
    empty.style.display = 'none';
    renderLineChart(svg, seriesList, { formatValue: fmt2, zeroLine: true });
    renderLegend(legend, seriesList.filter((s) => !s.dashed));
  }

  function haversineKm(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180, lat2 = b.lat * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function renderVectorPanel() {
    const container = $('od-vector-list');
    const badge = $('od-vector-badge');
    const occ = state.dashboard.triozaOccurrences;
    container.innerHTML = '';

    if (!occ || !occ.points || !occ.points.length) {
      container.innerHTML = '<div class="od-empty">Aucune occurrence chargée.</div>';
      return;
    }
    badge.style.display = occ.example ? 'inline-block' : 'none';
    if (occ.example) badge.textContent = 'DONNÉE D’EXEMPLE';

    Object.values(state.dashboard.regions)
      .filter((r) => r.kind !== 'vector_front')
      .forEach((region) => {
        let best = Infinity;
        occ.points.forEach((p) => {
          const d = haversineKm(region.centroid, { lat: p.lat, lon: p.lon });
          if (d < best) best = d;
        });
        const row = document.createElement('div');
        row.className = 'od-vector-row';
        row.innerHTML = `<span>${escapeHtml(region.name)}</span><span class="od-vector-dist">${Math.round(best)} km</span>`;
        container.appendChild(row);
      });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderAll() {
    renderIndexChart('od-card-ndvi', 'NDVI', 'NDVI');
    renderIndexChart('od-card-ndmi', 'NDMI', 'NDMI');
    renderIndexChart('od-card-evi', 'EVI', 'EVI');
    renderIndexChart('od-card-ndwi', 'NDWI', 'NDWI');
    renderSifChart();
    renderRiskPanel();
    renderVectorPanel();
  }

  // ---------------------------------------------------------------------
  // UI : filtres + sliders
  // ---------------------------------------------------------------------

  function buildRegionToggles() {
    const container = $('od-region-toggles');
    container.innerHTML = '';
    Object.values(state.dashboard.regions).forEach((region) => {
      const label = document.createElement('label');
      label.className = 'od-region-toggle';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = state.activeRegions.has(region.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) state.activeRegions.add(region.id); else state.activeRegions.delete(region.id);
        renderAll();
      });
      const swatch = document.createElement('span');
      swatch.className = 'od-swatch';
      swatch.style.background = cssVar(COLOR_VAR[region.colorSlot] || '--series-1');
      label.append(checkbox, swatch, document.createTextNode(region.name));
      container.appendChild(label);
    });
  }

  function bindSlider(id, key, isObj) {
    const input = $(id);
    const out = $(id + '-value');
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      if (isObj) state.weights[key] = v; else state[key] = v;
      out.textContent = input.dataset.suffix ? `${v}${input.dataset.suffix}` : v;
      renderRiskPanel();
    });
    out.textContent = input.dataset.suffix ? `${input.value}${input.dataset.suffix}` : input.value;
  }

  function bindFilters() {
    $('od-range-select').addEventListener('change', (e) => {
      state.dateRangeMonths = parseInt(e.target.value, 10);
      renderAll();
    });
    bindSlider('od-slider-ndvi', 'ndvi', true);
    bindSlider('od-slider-ndmi', 'ndmi', true);
    bindSlider('od-slider-sif', 'sif', true);
    bindSlider('od-slider-smoothing', 'smoothingWeeks', false);
    bindSlider('od-slider-threshold', 'alertThreshold', false);
  }

  async function init() {
    const status = $('od-status');
    try {
      state.dashboard = await loadDashboard();
    } catch (err) {
      status.textContent = `Impossible de charger les données (${err.message}).`;
      return;
    }
    if (!state.dashboard.timeseries || Object.keys(state.dashboard.timeseries).length === 0) {
      status.textContent = "Tableau de bord initialisé, en attente du premier rafraîchissement automatique (voir GitHub Actions).";
    } else {
      status.textContent = `Dernière mise à jour : ${new Date(state.dashboard.generatedAt).toLocaleString('fr-FR')}`;
    }
    buildRegionToggles();
    bindFilters();
    renderAll();
    window.addEventListener('resize', renderAll);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
