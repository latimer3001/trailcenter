/* global L */
'use strict';

const NS = 'http://www.topografix.com/GPX/1/1';

// Trail colors — visible on topo map light background
const TRAIL_COLORS = ['#e63946', '#2196f3', '#ff9800', '#9c27b0', '#00bcd4', '#4caf50'];

// ── App state ──
let gpxFiles     = [];   // [{doc, fileName, color, layer}]
let summitCoords = null;
let outputBlob   = null;
let activeTab    = 'auto';

// ── Map state ──
let map               = null;
let layerOrigBbox     = null;
let layerExpandedBbox = null;
let layerSummitMarker = null;

// ──────────────────────────────────────────────
// Map
// ──────────────────────────────────────────────

function initMap() {
  if (map) return;
  map = L.map('map', { zoomControl: true });
  L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data: © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors, SRTM | Style: © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    maxZoom: 17
  }).addTo(map);
}

function getPolylines(doc) {
  const segs = [...doc.getElementsByTagNameNS(NS, 'trkseg')];
  return segs
    .map(seg => [...seg.getElementsByTagNameNS(NS, 'trkpt')]
      .map(p => [parseFloat(p.getAttribute('lat')), parseFloat(p.getAttribute('lon'))]))
    .filter(pts => pts.length >= 2);
}

function getAllBbox() {
  // Compute merged bounding box across all loaded GPX files
  const allPts = gpxFiles.flatMap(f => {
    return getPolylines(f.doc).flat();
  });
  if (!allPts.length) return null;
  return {
    minLat: Math.min(...allPts.map(p => p[0])),
    maxLat: Math.max(...allPts.map(p => p[0])),
    minLon: Math.min(...allPts.map(p => p[1])),
    maxLon: Math.max(...allPts.map(p => p[1])),
  };
}

function redrawAllTrails() {
  if (!map) return;

  // Remove old trail layers
  gpxFiles.forEach(f => { if (f.layer) { map.removeLayer(f.layer); f.layer = null; } });
  if (layerOrigBbox) { map.removeLayer(layerOrigBbox); layerOrigBbox = null; }

  if (!gpxFiles.length) return;

  // Draw each trail in its color
  gpxFiles.forEach(f => {
    const polylines = getPolylines(f.doc);
    if (!polylines.length) return;
    f.layer = L.polyline(polylines, { color: f.color, weight: 2.5, opacity: 0.9 })
      .bindTooltip(f.fileName, { permanent: false, direction: 'top' })
      .addTo(map);
  });

  // Draw merged original bbox
  const bb = getAllBbox();
  if (bb) {
    layerOrigBbox = L.rectangle(
      [[bb.minLat, bb.minLon], [bb.maxLat, bb.maxLon]],
      { color: '#1565c0', weight: 1.5, dashArray: '6 4', fill: false, opacity: 0.8 }
    ).addTo(map);
  }

  document.getElementById('mapCard').style.display = 'block';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    map.invalidateSize();
    if (layerOrigBbox) map.fitBounds(layerOrigBbox.getBounds(), { padding: [28, 28] });
  }));
}

function drawExpandedBbox(expanded) {
  if (!map) return;
  if (layerExpandedBbox) { map.removeLayer(layerExpandedBbox); layerExpandedBbox = null; }
  layerExpandedBbox = L.rectangle(
    [[expanded.minLat, expanded.minLon], [expanded.maxLat, expanded.maxLon]],
    { color: '#e63946', weight: 2, dashArray: '10 5', fill: false, opacity: 0.95 }
  ).addTo(map);
  map.fitBounds(
    [[expanded.minLat, expanded.minLon], [expanded.maxLat, expanded.maxLon]],
    { padding: [28, 28] }
  );
}

function drawSummitMarker(lat, lon, name) {
  if (!map) return;
  if (layerSummitMarker) { map.removeLayer(layerSummitMarker); layerSummitMarker = null; }
  layerSummitMarker = L.circleMarker([lat, lon], {
    radius: 7, color: '#e63946', fillColor: '#e63946', fillOpacity: 0.4, weight: 2.5
  }).bindTooltip(name || 'Center', { permanent: false, direction: 'top' }).addTo(map);
}

// ──────────────────────────────────────────────
// File loading
// ──────────────────────────────────────────────

function loadFiles(files) {
  let pending = files.length;
  [...files].forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(e.target.result, 'application/xml');
        if (doc.querySelector('parsererror')) throw new Error('Invalid GPX/XML: ' + file.name);

        // Avoid duplicate filenames
        if (gpxFiles.find(f => f.fileName === file.name)) {
          log(`⚠ Already loaded: ${file.name}`, 'inf');
        } else {
          const color = TRAIL_COLORS[gpxFiles.length % TRAIL_COLORS.length];
          gpxFiles.push({ doc, fileName: file.name, color, layer: null });
          log(`✓ Loaded: ${file.name}`, 'ok');
        }
      } catch (ex) {
        log('✗ ' + ex.message, 'err');
      }
      pending--;
      if (pending === 0) {
        updateFileList();
        initMap();
        redrawAllTrails();
        document.getElementById('processBtn').disabled = gpxFiles.length === 0;
      }
    };
    reader.readAsText(file);
  });
}

function removeFile(index) {
  const f = gpxFiles[index];
  if (f && f.layer) map.removeLayer(f.layer);
  gpxFiles.splice(index, 1);
  // Reassign colors in order
  gpxFiles.forEach((f, i) => { f.color = TRAIL_COLORS[i % TRAIL_COLORS.length]; });
  updateFileList();
  redrawAllTrails();
  document.getElementById('processBtn').disabled = gpxFiles.length === 0;
  if (gpxFiles.length === 0) document.getElementById('mapCard').style.display = 'none';
}

function updateFileList() {
  const el = document.getElementById('fileList');
  if (!gpxFiles.length) { el.innerHTML = ''; return; }
  el.innerHTML = gpxFiles.map((f, i) => `
    <div class="file-item">
      <span class="file-dot" style="background:${f.color}"></span>
      <span class="file-name">${f.fileName}</span>
      <button class="file-remove" onclick="removeFile(${i})" title="Remove">✕</button>
    </div>
  `).join('');
}

// ──────────────────────────────────────────────
// Tabs
// ──────────────────────────────────────────────

function switchTab(name) {
  activeTab = name;
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', ['auto', 'coords', 'manual'][i] === name);
  });
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
}

// ──────────────────────────────────────────────
// OSM Summit Lookup
// ──────────────────────────────────────────────

async function lookupSummit() {
  const name = document.getElementById('summitName').value.trim();
  if (!name) return;

  const btn    = document.getElementById('lookupBtn');
  const status = document.getElementById('lookupStatus');
  btn.disabled = true;
  btn.textContent = '...';
  setStatus(status, 'inf', 'Searching OpenStreetMap...');

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=5`,
      { headers: { 'User-Agent': 'TrailCenter/1.0' } }
    );
    const results = await res.json();
    if (!results.length) throw new Error('No results found. Try a more specific name.');

    const peaks = results.filter(r => ['peak', 'mountain', 'hill', 'volcano'].includes(r.type));
    const best  = peaks.length ? peaks[0] : results[0];

    summitCoords = { lat: parseFloat(best.lat), lon: parseFloat(best.lon), name: best.display_name };
    setStatus(status, 'ok',
      `✓ ${best.display_name.split(',').slice(0, 3).join(',')}\n  ${summitCoords.lat.toFixed(5)}, ${summitCoords.lon.toFixed(5)}`
    );
    if (map) drawSummitMarker(summitCoords.lat, summitCoords.lon, best.display_name.split(',')[0]);

  } catch (ex) {
    summitCoords = null;
    setStatus(status, 'err', '✗ ' + ex.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Lookup';
  }
}

function setStatus(el, type, msg) {
  el.className   = 'status show ' + type;
  el.textContent = msg;
}

// ──────────────────────────────────────────────
// GPX helpers
// ──────────────────────────────────────────────

function getTrkPts(doc) {
  return [...doc.getElementsByTagNameNS(NS, 'trkpt')];
}

function getBboxFromDocs(docs) {
  const pts = docs.flatMap(d => getTrkPts(d));
  const lats = pts.map(p => parseFloat(p.getAttribute('lat')));
  const lons = pts.map(p => parseFloat(p.getAttribute('lon')));
  return {
    minLat: Math.min(...lats), maxLat: Math.max(...lats),
    minLon: Math.min(...lons), maxLon: Math.max(...lons)
  };
}

// Build a merged GPX document from all loaded files
function buildMergedDoc() {
  const parser = new DOMParser();
  const merged = parser.parseFromString(
    `<?xml version="1.0" encoding="UTF-8"?>
     <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="TrailCenter"></gpx>`,
    'application/xml'
  );
  const root = merged.documentElement;

  gpxFiles.forEach((f, i) => {
    // Clone each <trk> from each file and append to merged doc
    const trks = [...f.doc.getElementsByTagNameNS(NS, 'trk')];
    trks.forEach(trk => {
      const importedTrk = merged.importNode(trk, true);
      // Label each track with its source file
      let nameEl = importedTrk.getElementsByTagNameNS(NS, 'name')[0];
      if (!nameEl) {
        nameEl = merged.createElementNS(NS, 'name');
        importedTrk.insertBefore(nameEl, importedTrk.firstChild);
      }
      nameEl.textContent = f.fileName.replace(/\.gpx$/i, '');
      root.appendChild(importedTrk);
    });
  });

  return merged;
}

function addPhantomPoint(doc, trk, lat, lon, label) {
  const seg = doc.createElementNS(NS, 'trkseg');
  const pt  = doc.createElementNS(NS, 'trkpt');
  pt.setAttribute('lat', lat.toFixed(6));
  pt.setAttribute('lon', lon.toFixed(6));
  const ele = doc.createElementNS(NS, 'ele');
  ele.textContent = '0';
  pt.appendChild(ele);
  seg.appendChild(pt);
  trk.appendChild(seg);
  log(`  phantom [${label}]: ${lat.toFixed(5)}, ${lon.toFixed(5)}`, 'acc');
}

// ──────────────────────────────────────────────
// Log
// ──────────────────────────────────────────────

function log(msg, cls = '') {
  const el   = document.getElementById('log');
  el.classList.add('show');
  const line = document.createElement('div');
  if (cls) line.className = cls;
  line.textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function clearLog() {
  const el = document.getElementById('log');
  el.innerHTML = '';
  el.classList.remove('show');
}

// ──────────────────────────────────────────────
// Core: expand GPX
// ──────────────────────────────────────────────

function expandAuto(doc, cLat, cLon, pad) {
  const docs = gpxFiles.map(f => f.doc);
  const bb   = getBboxFromDocs(docs);

  log(`Merged bbox: Lat ${bb.minLat.toFixed(4)}→${bb.maxLat.toFixed(4)}  Lon ${bb.minLon.toFixed(4)}→${bb.maxLon.toFixed(4)}`);
  log(`Center: ${cLat.toFixed(5)}, ${cLon.toFixed(5)}`, 'inf');

  const halfLat = Math.max(cLat - bb.minLat, bb.maxLat - cLat) + pad;
  const halfLon = Math.max(cLon - bb.minLon, bb.maxLon - cLon) + pad;
  const exp = {
    minLat: cLat - halfLat, maxLat: cLat + halfLat,
    minLon: cLon - halfLon, maxLon: cLon + halfLon
  };

  // Add phantom points to first trk in merged doc
  const trk = doc.getElementsByTagNameNS(NS, 'trk')[0];
  if (exp.maxLat > bb.maxLat) addPhantomPoint(doc, trk, exp.maxLat, cLon,       'top');
  if (exp.minLat < bb.minLat) addPhantomPoint(doc, trk, exp.minLat, cLon,       'bottom');
  if (exp.maxLon > bb.maxLon) addPhantomPoint(doc, trk, cLat,       exp.maxLon, 'right');
  if (exp.minLon < bb.minLon) addPhantomPoint(doc, trk, cLat,       exp.minLon, 'left');

  return { orig: bb, expanded: exp };
}

function expandManual(doc, right, left, top, bottom) {
  const docs   = gpxFiles.map(f => f.doc);
  const bb     = getBboxFromDocs(docs);
  const midLat = (bb.minLat + bb.maxLat) / 2;
  const midLon = (bb.minLon + bb.maxLon) / 2;

  log(`Merged bbox: Lat ${bb.minLat.toFixed(4)}→${bb.maxLat.toFixed(4)}  Lon ${bb.minLon.toFixed(4)}→${bb.maxLon.toFixed(4)}`);

  const trk = doc.getElementsByTagNameNS(NS, 'trk')[0];
  if (right)  addPhantomPoint(doc, trk, midLat,             bb.maxLon + right, 'right');
  if (left)   addPhantomPoint(doc, trk, midLat,             bb.minLon - left,  'left');
  if (top)    addPhantomPoint(doc, trk, bb.maxLat + top,    midLon,            'top');
  if (bottom) addPhantomPoint(doc, trk, bb.minLat - bottom, midLon,            'bottom');

  return {
    orig: bb,
    expanded: {
      minLat: bb.minLat - bottom, maxLat: bb.maxLat + top,
      minLon: bb.minLon - left,   maxLon: bb.maxLon + right
    }
  };
}

// ──────────────────────────────────────────────
// Bbox display
// ──────────────────────────────────────────────

function showBbox(result) {
  const { orig: o, expanded: e } = result;
  const fmt = (v, changed) => changed ? `<span class="new">${v.toFixed(5)}</span>` : v.toFixed(5);

  document.getElementById('bboxOrig').innerHTML =
    `Lat: ${o.minLat.toFixed(5)} → ${o.maxLat.toFixed(5)}<br>Lon: ${o.minLon.toFixed(5)} → ${o.maxLon.toFixed(5)}`;
  document.getElementById('bboxNew').innerHTML =
    `Lat: ${fmt(e.minLat, e.minLat < o.minLat)} → ${fmt(e.maxLat, e.maxLat > o.maxLat)}<br>` +
    `Lon: ${fmt(e.minLon, e.minLon < o.minLon)} → ${fmt(e.maxLon, e.maxLon > o.maxLon)}`;

  document.getElementById('bboxGrid').style.display = 'grid';
}

// ──────────────────────────────────────────────
// Process
// ──────────────────────────────────────────────

function process() {
  if (!gpxFiles.length) return;
  clearLog();
  document.getElementById('bboxGrid').style.display = 'none';
  document.getElementById('downloadBtn').classList.remove('show');

  log(`Processing ${gpxFiles.length} GPX file${gpxFiles.length > 1 ? 's' : ''}...`, 'inf');

  // Build merged doc from all files
  const doc = buildMergedDoc();
  let result, cLat, cLon, cName;

  try {
    if (activeTab === 'auto') {
      if (!summitCoords) { log('✗ Click Lookup to resolve summit coordinates first.', 'err'); return; }
      const pad = parseFloat(document.getElementById('autoPadding').value) || 0.01;
      log(`Mode: auto-center on "${summitCoords.name.split(',')[0]}"`, 'inf');
      cLat  = summitCoords.lat;
      cLon  = summitCoords.lon;
      cName = summitCoords.name.split(',')[0];
      result = expandAuto(doc, cLat, cLon, pad);

    } else if (activeTab === 'coords') {
      cLat = parseFloat(document.getElementById('manLat').value);
      cLon = parseFloat(document.getElementById('manLon').value);
      if (isNaN(cLat) || isNaN(cLon)) { log('✗ Enter valid lat/lon coordinates.', 'err'); return; }
      const pad = parseFloat(document.getElementById('coordPadding').value) || 0.01;
      log(`Mode: center on ${cLat.toFixed(5)}, ${cLon.toFixed(5)}`, 'inf');
      cName  = 'Center point';
      result = expandAuto(doc, cLat, cLon, pad);

    } else {
      const r = parseFloat(document.getElementById('padRight').value)  || 0;
      const l = parseFloat(document.getElementById('padLeft').value)   || 0;
      const t = parseFloat(document.getElementById('padTop').value)    || 0;
      const b = parseFloat(document.getElementById('padBottom').value) || 0;
      log(`Mode: manual padding R${r} L${l} T${t} B${b}`, 'inf');
      result = expandManual(doc, r, l, t, b);
    }

    // Redraw map cleanly from original docs
    redrawAllTrails();
    drawExpandedBbox(result.expanded);
    if (cLat !== undefined) drawSummitMarker(cLat, cLon, cName);

    const serialized = new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^?]*\?>\s*/i, '');
    const xmlStr = '<?xml version="1.0" encoding="UTF-8"?>\n' + serialized;
    outputBlob = new Blob([xmlStr], { type: 'application/gpx+xml' });

    showBbox(result);
    log('✓ Done! Download your expanded GPX below.', 'ok');

    const baseName = gpxFiles.length === 1
      ? gpxFiles[0].fileName.replace(/\.gpx$/i, '')
      : 'merged_trails';

    const btn    = document.getElementById('downloadBtn');
    btn.href     = URL.createObjectURL(outputBlob);
    btn.download = baseName + '_expanded.gpx';
    btn.classList.add('show');

  } catch (ex) {
    log('✗ Error: ' + ex.message, 'err');
  }
}

// ──────────────────────────────────────────────
// Event listeners
// ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('gpxFile');

  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) loadFiles(fileInput.files);
    fileInput.value = ''; // reset so same file can be re-added after removal
  });

  document.getElementById('summitName').addEventListener('keydown', e => {
    if (e.key === 'Enter') lookupSummit();
  });
  document.getElementById('trailSearchName').addEventListener('keydown', e => {
    if (e.key === 'Enter') searchTrails();
  });
});

// ──────────────────────────────────────────────
// Input tab switching (Upload vs OSM Search)
// ──────────────────────────────────────────────

function switchInputTab(name) {
  document.querySelectorAll('.input-tab').forEach((t, i) => {
    t.classList.toggle('active', ['upload', 'search'][i] === name);
  });
  document.querySelectorAll('.input-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('ipanel-' + name).classList.add('active');
}

// ──────────────────────────────────────────────
// OSM Trail Search via Overpass
// ──────────────────────────────────────────────

async function searchTrails() {
  const name = document.getElementById('trailSearchName').value.trim();
  if (!name) return;

  const btn    = document.getElementById('trailSearchBtn');
  const status = document.getElementById('trailSearchStatus');
  const results = document.getElementById('trailResults');

  btn.disabled = true;
  btn.textContent = '...';
  results.innerHTML = '';
  setStatus(status, 'inf', 'Querying OpenStreetMap...');

  // Query for hiking route relations matching the name
  const query = `
    [out:json][timeout:25];
    relation[type=route][route=hiking][name~"${name.replace(/"/g, '')}",i];
    out geom;
  `;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query)
    });

    if (!res.ok) throw new Error(`Overpass API error ${res.status} — try again in a moment`);

    const text = await res.text();
    // Overpass occasionally returns an HTML error page instead of JSON
    if (text.trim().startsWith('<')) throw new Error('Overpass returned an error page — server may be busy, try again shortly');

    const data = JSON.parse(text);

    if (!data.elements || !data.elements.length) {
      setStatus(status, 'err', '✗ No hiking routes found. Try a different name or use AllTrails GPX.');
      btn.disabled = false;
      btn.textContent = 'Search';
      return;
    }

    setStatus(status, 'ok', `✓ Found ${data.elements.length} route${data.elements.length > 1 ? 's' : ''}`);
    renderTrailResults(data.elements);

  } catch (ex) {
    setStatus(status, 'err', '✗ ' + ex.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Search';
  }
}

function renderTrailResults(elements) {
  const el = document.getElementById('trailResults');
  el.innerHTML = elements.map((r, i) => {
    const name     = r.tags.name || 'Unnamed route';
    const network  = r.tags.network || '';
    const distance = r.tags.distance || r.tags['distance:km'] || '';
    const operator = r.tags.operator || r.tags.from || '';
    const meta = [network, distance ? distance + ' km' : '', operator].filter(Boolean).join(' · ');
    return `
      <div class="trail-result" onclick="importOsmTrail(${i})" data-index="${i}">
        <div class="trail-result-name">${name}</div>
        ${meta ? `<div class="trail-result-meta">${meta}</div>` : ''}
      </div>
    `;
  }).join('');
  // Store results for import
  window._osmResults = elements;
}

function importOsmTrail(index) {
  const element = window._osmResults[index];
  if (!element) return;

  try {
    const doc = osmRelationToGpx(element);
    const name = (element.tags.name || 'osm_trail').replace(/[^a-z0-9_\-]/gi, '_') + '.gpx';

    if (gpxFiles.find(f => f.fileName === name)) {
      log(`⚠ Already loaded: ${name}`, 'inf');
      return;
    }

    const color = TRAIL_COLORS[gpxFiles.length % TRAIL_COLORS.length];
    gpxFiles.push({ doc, fileName: name, color, layer: null });

    updateFileList();
    initMap();
    redrawAllTrails();
    document.getElementById('processBtn').disabled = false;

    // Highlight selected result
    document.querySelectorAll('.trail-result').forEach((el, i) => {
      el.classList.toggle('selected', i === index);
    });

    log(`✓ Imported from OpenStreetMap: ${element.tags.name || 'trail'}`, 'ok');

  } catch (ex) {
    log('✗ Failed to import trail: ' + ex.message, 'err');
  }
}

// Convert an Overpass relation element (with geom) to a GPX XML document
function osmRelationToGpx(relation) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<?xml version="1.0" encoding="UTF-8"?>
     <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="TrailCenter/OSM"></gpx>`,
    'application/xml'
  );
  const root = doc.documentElement;
  const trk  = doc.createElementNS(NS, 'trk');

  // Name
  const nameEl = doc.createElementNS(NS, 'name');
  nameEl.textContent = relation.tags.name || 'OSM Trail';
  trk.appendChild(nameEl);

  // Extract way geometries from members, in member order
  const ways = (relation.members || [])
    .filter(m => m.type === 'way' && m.geometry && m.geometry.length >= 2)
    .map(m => m.geometry.map(n => [n.lat, n.lon]));

  if (!ways.length) throw new Error('No way geometry found in this relation.');

  // Stitch ways into continuous segments
  const stitched = stitchWays(ways);

  // Each stitched segment becomes a trkseg
  stitched.forEach(seg => {
    const trkseg = doc.createElementNS(NS, 'trkseg');
    seg.forEach(([lat, lon]) => {
      const pt = doc.createElementNS(NS, 'trkpt');
      pt.setAttribute('lat', lat.toFixed(6));
      pt.setAttribute('lon', lon.toFixed(6));
      trkseg.appendChild(pt);
    });
    trk.appendChild(trkseg);
  });

  root.appendChild(trk);
  return doc;
}

// Stitch an array of way coordinate arrays into continuous segments
// Reverses individual ways as needed to connect end-to-end
function stitchWays(ways) {
  if (!ways.length) return [];

  const SNAP = 0.0001; // ~11m — close enough to be "connected"
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  const segments = [ways[0].slice()];

  for (let i = 1; i < ways.length; i++) {
    const way  = ways[i];
    const last = segments[segments.length - 1];
    const tail = last[last.length - 1];
    const wHead = way[0];
    const wTail = way[way.length - 1];

    if (dist(tail, wHead) < SNAP) {
      // Connects forward — append
      last.push(...way.slice(1));
    } else if (dist(tail, wTail) < SNAP) {
      // Connects if reversed
      last.push(...way.slice(0, -1).reverse());
    } else {
      // Gap — start a new segment
      segments.push(way.slice());
    }
  }

  return segments;
}
