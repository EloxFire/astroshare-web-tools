import { useState, type RefObject } from 'react';
import { Download } from 'lucide-react';
import L from 'leaflet';
import SimpleButton from './SimpleButton';
import { SOLAR_LEGEND, LUNAR_LEGEND } from './VisibilityLegend';
import type { SolarReportParams, LunarReportParams } from '../helpers/pdfReport';
import type { HorizonSample } from '../helpers/horizonObstruction';
import { azimuthToCompass } from '../helpers/visibilityRating';

export type CircumstancesPayload =
  | { kind: 'solar'; params: SolarReportParams }
  | { kind: 'lunar'; params: LunarReportParams };

interface ExportPdfControlProps {
  mapRef: RefObject<L.Map | null>;
  kind: 'solar' | 'lunar';
  circumstances: CircumstancesPayload | null;
  fileName: string;
  panelVisible: boolean;
  onTogglePanel: () => void;
  hasTrackedCities: boolean;
  terrainProfile: HorizonSample[] | null;
  terrainTargetAltitudeDeg: number | undefined;
  terrainTargetAzimuthDeg: number | undefined;
  originName: string;
}

// `pinnedTopLeft` : quand le profil de relief est aussi inclus dans l'export, il occupe tout le bas
// de la carte (voir buildHorizonProfileElement) — la légende remonte alors en haut à gauche pour ne
// pas s'y superposer (voir solar-eclipse-details__export-legend-corner--top dans EclipseDetails.css).
const buildLegendElement = (kind: 'solar' | 'lunar', pinnedTopLeft: boolean): HTMLElement => {
  const entries = kind === 'solar' ? SOLAR_LEGEND : LUNAR_LEGEND;
  const wrapper = document.createElement('div');
  wrapper.className = `solar-eclipse-details__export-legend-corner${pinnedTopLeft ? ' solar-eclipse-details__export-legend-corner--top' : ''}`;
  const items = entries
    .map((entry) => {
      const swatchClass =
        entry.kind === 'area' ? 'visibility-legend__swatch visibility-legend__swatch--area' : 'visibility-legend__swatch';
      const swatchStyle =
        entry.kind === 'area'
          ? `background-color:${entry.color}59;border-color:${entry.color}`
          : `background-color:${entry.color}`;
      return `<div class="visibility-legend__item"><span class="${swatchClass}" style="${swatchStyle}"></span><span>${entry.label}</span></div>`;
    })
    .join('');
  wrapper.innerHTML = `<p class="visibility-legend__title">Zones &amp; lignes de visibilité</p>${items}`;
  return wrapper;
};

// Reconstruit le graphique de HorizonProfilePanel (voir ce composant) en DOM/SVG "à plat", plutôt que
// de réutiliser directement le composant React : le panneau flottant vit hors du conteneur Leaflet
// (sibling de <EclipseMap>, positionné en absolu par-dessus), donc html2canvas(mapNode) ne le capture
// jamais — même principe que buildLegendElement ci-dessus (reconstruire dans le DOM du conteneur
// plutôt que de tenter d'y déplacer un nœud React monté ailleurs). Les classes CSS (`horizon-profile-
// panel__*`) sont réutilisées telles quelles : leur feuille de style est déjà chargée dès que l'écran
// de détails a été rendu une fois. Pas de bouton "voir des points de vue dégagés" ici : un export figé
// n'a pas d'usage pour une action interactive.
const HORIZON_CHART_WIDTH = 1000;
const HORIZON_CHART_HEIGHT = 190;
const HORIZON_PADDING_X = 20;
const HORIZON_PADDING_TOP = 38;
const HORIZON_PADDING_BOTTOM = 46;

const truncateForExport = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// Même algorithme (Catmull-Rom en segments de Bézier cubiques) que HorizonProfilePanel.tsx — dupliqué
// ici plutôt que partagé, dans la continuité de buildLegendElement qui reconstruit aussi son propre
// balisage plutôt que d'importer le rendu du composant vivant.
const buildSmoothPathForExport = (pts: { x: number; y: number }[]): string => {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;

  let path = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return path;
};

const buildHorizonProfileElement = (
  profile: HorizonSample[],
  targetAltitudeDeg: number,
  targetAzimuthDeg: number,
  originName: string,
): HTMLElement => {
  const samples: HorizonSample[] = [{ distanceKm: 0, angleDeg: 0, lat: 0, lng: 0, elevationM: 0 }, ...profile];
  const angles = samples.map((sample) => sample.angleDeg);
  const minAngle = Math.min(0, targetAltitudeDeg, ...angles);
  const maxAngle = Math.max(targetAltitudeDeg, ...angles) * 1.15 || 1;
  const range = maxAngle - minAngle || 1;

  const plotWidth = HORIZON_CHART_WIDTH - HORIZON_PADDING_X * 2;
  const plotHeight = HORIZON_CHART_HEIGHT - HORIZON_PADDING_TOP - HORIZON_PADDING_BOTTOM;
  const floorY = HORIZON_PADDING_TOP + plotHeight;

  const xFor = (index: number) => HORIZON_PADDING_X + (index / (samples.length - 1)) * plotWidth;
  const yFor = (angle: number) => floorY - ((angle - minAngle) / range) * plotHeight;

  const points = samples.map((sample, index) => ({
    ...sample,
    x: xFor(index),
    y: yFor(sample.angleDeg),
    blocking: sample.angleDeg >= targetAltitudeDeg,
  }));

  const [originPoint, ...terrainPoints] = points;
  const eclipseY = yFor(targetAltitudeDeg);

  const linePath = buildSmoothPathForExport(points.map((p) => ({ x: p.x, y: p.y })));
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)},${floorY.toFixed(1)} L ${originPoint.x.toFixed(1)},${floorY.toFixed(1)} Z`;

  const xPct = (x: number) => `${(x / HORIZON_CHART_WIDTH) * 100}%`;
  const yPct = (y: number) => `${(y / HORIZON_CHART_HEIGHT) * 100}%`;

  const dotsMarkup = terrainPoints
    .map(
      (point) =>
        `<span class="horizon-profile-panel__dot horizon-profile-panel__dot--${point.blocking ? 'blocking' : 'clear'}" style="left:${xPct(point.x)};top:${yPct(point.y)}"></span>`,
    )
    .join('');

  const ticksMarkup = terrainPoints
    .map(
      (point) =>
        `<div class="horizon-profile-panel__tick" style="left:${xPct(point.x)};top:${yPct(HORIZON_CHART_HEIGHT - 6)}"><span class="horizon-profile-panel__tick-distance">${point.distanceKm}km</span><span class="horizon-profile-panel__tick-elevation">${Math.round(point.elevationM)}m</span></div>`,
    )
    .join('');

  const wrapper = document.createElement('div');
  wrapper.className = 'horizon-profile-panel horizon-profile-panel--export';
  wrapper.innerHTML = `
    <div class="horizon-profile-panel__header">
      <svg width="18" height="18" viewBox="0 0 22 22" class="horizon-profile-panel__arrow">
        <polygon points="11,1 20,19 11,14 2,19" fill="#f4c238" stroke="#000000" stroke-width="1.5" transform="rotate(${targetAzimuthDeg.toFixed(1)} 11 11)" />
      </svg>
      <span class="horizon-profile-panel__header-text">Relief testé depuis ${originName ? `<strong>${originName}</strong>` : 'le lieu sélectionné'} vers ${azimuthToCompass(targetAzimuthDeg)} (${Math.round(targetAzimuthDeg)}°)</span>
    </div>
    <div class="horizon-profile-panel__chart-wrap">
      <svg viewBox="0 0 ${HORIZON_CHART_WIDTH} ${HORIZON_CHART_HEIGHT}" preserveAspectRatio="none" class="horizon-profile-panel__chart">
        <defs>
          <linearGradient id="export-horizon-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f4c238" stop-opacity="0.4" />
            <stop offset="100%" stop-color="#f4c238" stop-opacity="0.03" />
          </linearGradient>
        </defs>
        <path d="${areaPath}" fill="url(#export-horizon-gradient)" class="horizon-profile-panel__area" />
        <line x1="${HORIZON_PADDING_X}" x2="${HORIZON_CHART_WIDTH - HORIZON_PADDING_X}" y1="${eclipseY}" y2="${eclipseY}" class="horizon-profile-panel__eclipse-line" />
        <line x1="${originPoint.x}" x2="${originPoint.x}" y1="${HORIZON_PADDING_TOP - 14}" y2="${floorY}" class="horizon-profile-panel__origin-line" />
        <path d="${linePath}" class="horizon-profile-panel__line" />
      </svg>
      <span class="horizon-profile-panel__eclipse-label" style="left:${xPct(HORIZON_PADDING_X)};top:${yPct(Math.max(14, eclipseY - 8))}">Éclipse ${targetAltitudeDeg.toFixed(1)}°</span>
      <span class="horizon-profile-panel__origin-label" style="left:${xPct(originPoint.x)};top:${yPct(HORIZON_PADDING_TOP - 18)}">${truncateForExport(originName || 'Départ', 26)}</span>
      <span class="horizon-profile-panel__dot horizon-profile-panel__dot--origin" style="left:${xPct(originPoint.x)};top:${yPct(originPoint.y)}"></span>
      ${dotsMarkup}
      ${ticksMarkup}
    </div>
    <p class="horizon-profile-panel__disclaimer">Basé uniquement sur le relief naturel (topographie) : bâtiments, arbres et autres structures ne sont pas pris en compte.</p>
  `;
  return wrapper;
};

// Chargé une seule fois puis mis en cache (fichier statique, identique d'un export à l'autre) —
// dessiné directement sur le canevas final avec drawImage() plutôt qu'ajouté comme <img> capturé par
// html2canvas, pour la même raison que le fond de carte (voir compositeTileLayer/fetchStaticBasemap
// plus haut) : son chargeur d'image interne s'est révélé peu fiable pour cette capture, quelle que
// soit la source de l'image.
const LOGO_SRC = '/ASTROSHARE_LOGO_BLACK.png';
let logoImagePromise: Promise<HTMLImageElement | null> | null = null;
const loadLogoImage = (): Promise<HTMLImageElement | null> => {
  logoImagePromise ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = LOGO_SRC;
  });
  return logoImagePromise;
};

// Taille proportionnelle à la largeur du canevas final (donc à la largeur physique de la page PDF,
// puisque mapCanvas est ensuite posé pleine largeur sur celle-ci) plutôt qu'une taille fixe en
// pixels : reste cohérent quelle que soit la résolution cible (voir TARGET_MAP_WIDTH_PX) sans jamais
// paraître disproportionné.
const LOGO_WIDTH_RATIO = 0.1;

// Même marge (16px CSS) que .solar-eclipse-details__export-legend-corner et
// .horizon-profile-panel--export, multipliée par `scale` (le même facteur que celui utilisé pour
// capturer ces éléments-là via html2canvas) : les bords du logo s'alignent ainsi exactement avec ceux
// des autres cartouches de l'export, plutôt que de dériver indépendamment de la largeur du canevas.
const LOGO_MARGIN_CSS_PX = 16;

const drawLogoBadge = (ctx: CanvasRenderingContext2D, canvasWidth: number, scale: number, logo: HTMLImageElement) => {
  const margin = LOGO_MARGIN_CSS_PX * scale;
  const logoWidth = canvasWidth * LOGO_WIDTH_RATIO;
  const logoHeight = logoWidth * (logo.naturalHeight / logo.naturalWidth);
  const x = canvasWidth - margin - logoWidth;
  const y = margin;

  // Halo blanc flou plutôt qu'un cartouche plein : le flou suit la silhouette du logo (texte + trait
  // fin), donc il se détache proprement de n'importe quel fond de carte sans ajouter de bloc uni.
  ctx.save();
  ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
  ctx.shadowBlur = logoWidth * 0.08;
  ctx.drawImage(logo, x, y, logoWidth, logoHeight);
  ctx.restore();
};

const MAP_PAGE_WIDTH_MM = 297;

// 300 dpi = résolution standard pour une impression nette (contre ~72-96 dpi pour un usage écran
// seul) — cible fixe indépendante de la taille de fenêtre ou de l'écran de l'utilisateur, plutôt que
// de dériver la résolution de `window.devicePixelRatio` (qui ne reflète que l'écran de la personne
// qui exporte : 1 sur un moniteur standard, jusqu'à 3 sur un mobile récent — sans rapport avec la
// qualité d'impression visée). Donne une image d'environ 3508px de large pour la page A4 paysage.
const PRINT_DPI = 300;
const MM_PER_INCH = 25.4;
const TARGET_MAP_WIDTH_PX = Math.round((MAP_PAGE_WIDTH_MM / MM_PER_INCH) * PRINT_DPI);
// Garde-fou : sur un très petit conteneur (mobile, panneau replié), viser pile 300dpi impliquerait un
// facteur d'échelle démesuré. Un facteur 8 reste largement suffisant pour un rendu net à l'écran comme
// à l'impression, sans risquer un canevas ingérable en mémoire/temps de calcul.
const MAX_EXPORT_SCALE = 8;

const isTileLoaded = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0;

// Attend que Leaflet lui-même n'ait plus de tuiles en vol pour les couches actives, avant même de
// commencer à inspecter le DOM. Une vue large (export dézoomé, ex. la France entière) déclenche des
// dizaines de requêtes de tuiles quasi simultanées ; le simple polling des <img> du DOM peut sortir
// trop tôt si Leaflet est encore en train d'ajouter de nouveaux éléments <img> au moment du contrôle.
// isLoading()/'load' reflète l'état interne réel de la couche (vrai dès que toutes les tuiles en
// cours ont fini, en succès ou en erreur), ce qui referme cette fenêtre de course.
const waitForTileLayersToSettle = (map: L.Map, timeoutMs = 8000): Promise<void> =>
  new Promise((resolve) => {
    const layers: L.TileLayer[] = [];
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) layers.push(layer);
    });

    const loading = layers.filter((layer) => layer.isLoading());
    if (loading.length === 0) {
      resolve();
      return;
    }

    let pending = loading.length;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    loading.forEach((layer) =>
      layer.once('load', () => {
        pending -= 1;
        if (pending <= 0) finish();
      }),
    );
    setTimeout(finish, timeoutMs);
  });

// Recharge une tuile bloquée avec une URL cache-bustée (pour contourner un cache navigateur sans
// en-têtes CORS) — utilisé en dernier recours, avec plusieurs passes espacées ci-dessous.
const reloadTile = (img: HTMLImageElement, timeoutMs: number): Promise<void> =>
  new Promise((resolve) => {
    const cleanup = () => {
      img.removeEventListener('load', cleanup);
      img.removeEventListener('error', cleanup);
      resolve();
    };
    img.addEventListener('load', cleanup);
    img.addEventListener('error', cleanup);
    img.crossOrigin = 'anonymous';
    const baseUrl = img.src.split('?')[0];
    img.src = `${baseUrl}?cachebust=${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setTimeout(cleanup, timeoutMs);
  });

// Espacement croissant entre les passes de rechargement : une tuile encore bloquée après le premier
// passage a de bonnes chances d'avoir été limitée en débit par le serveur de tuiles (Mapbox), pas
// juste d'être lente — retenter immédiatement recreerait la même rafale. Laisser quelques centaines
// de ms à quelques secondes avant de retenter donne à cette éventuelle limite le temps de se relâcher.
const RETRY_DELAYS_MS = [400, 1200, 2500];

// Attend que toutes les tuiles visibles aient fini de charger, puis retente plusieurs fois les
// tuiles encore bloquées après le premier délai. Une tuile peut rester bloquée pour plusieurs
// raisons : elle est simplement encore en vol, elle a été mise en cache par le navigateur sans les
// en-têtes CORS attendus par crossOrigin="anonymous" (html2canvas la traite alors comme "tainted" et
// la laisse blanche), ou elle a été temporairement rejetée par une limite de débit du serveur de
// tuiles sur une rafale de requêtes (fréquent sur un export dézoomé avec beaucoup de tuiles).
const waitForTilesLoaded = async (mapNode: HTMLElement, timeoutMs = 10000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const images = Array.from(mapNode.querySelectorAll('img'));
    if (images.length > 0 && images.every(isTileLoaded)) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  let stuck = Array.from(mapNode.querySelectorAll('img')).filter((img) => !isTileLoaded(img));
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length && stuck.length > 0; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(stuck.map((img) => reloadTile(img, 5000)));
    stuck = stuck.filter((img) => !isTileLoaded(img));
  }
};

// Compose nous-mêmes le fond de carte (tuiles) sur un canevas, en lisant directement les <img> déjà
// chargés par le navigateur — aucune requête, aucun rechargement, html2canvas-pro n'intervient plus
// du tout sur les tuiles. getBoundingClientRect() donne la position/taille finale réellement rendue
// de chaque tuile après toute transform CSS de Leaflet. `crossOrigin="anonymous"` est déjà posé sur
// les <TileLayer> (voir EclipseMap/LunarEclipseMap) dès la création des tuiles : drawImage() ne
// "taint" donc pas le canevas. Repli utilisé quand le fond de carte n'est pas un style Mapbox (voir
// buildTileCanvas ci-dessous) — le fond CARTO n'a pas d'équivalent "image statique unique".
const compositeTileLayer = (mapNode: HTMLElement, scale: number): HTMLCanvasElement => {
  const mapRect = mapNode.getBoundingClientRect();
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(mapRect.width * scale));
  canvas.height = Math.max(1, Math.round(mapRect.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);

  const tiles = Array.from(mapNode.querySelectorAll<HTMLImageElement>('.leaflet-tile'));
  tiles.forEach((img) => {
    if (!img.complete || img.naturalWidth === 0) return;
    const rect = img.getBoundingClientRect();
    try {
      ctx.drawImage(img, rect.left - mapRect.left, rect.top - mapRect.top, rect.width, rect.height);
    } catch {
      // Tuile "taintée" (ne devrait pas arriver, crossOrigin déjà en place à la création) — ignorée
      // plutôt que de faire échouer toute la composition.
    }
  });

  return canvas;
};

const MAPBOX_STATIC_MAX_DIMENSION = 1280;

// Détecte si le fond de carte affiché est un style Mapbox (mode "relief topographique", voir
// topographyTiles.ts) en lisant l'URL d'une tuile déjà présente dans le DOM — évite de faire remonter
// le token/l'état showTopography depuis l'écran jusqu'ici par des props dédiées rien que pour ça.
const detectMapboxStyleSource = (mapNode: HTMLElement): { styleId: string; token: string } | null => {
  const tile = mapNode.querySelector<HTMLImageElement>('.leaflet-tile');
  if (!tile || !tile.src.includes('api.mapbox.com/styles/v1/')) return null;
  const styleMatch = tile.src.match(/styles\/v1\/([^/]+\/[^/]+)\/tiles\//);
  const tokenMatch = tile.src.match(/[?&]access_token=([^&]+)/);
  if (!styleMatch || !tokenMatch) return null;
  return { styleId: styleMatch[1], token: tokenMatch[1] };
};

// Récupère le fond de carte en UNE seule image via l'API Static Images de Mapbox plutôt que
// d'assembler les tuiles individuelles du DOM. Après plusieurs échecs d'approches par fragments
// (html2canvas rechargeant lui-même chaque tuile en interne — constaté peu fiable en console, même
// avec des URL blob locales déjà chargées — puis une recomposition manuelle par tuile, elle-même
// perturbée par le moindre rechargement de tuiles en cours), cette voie contourne le problème à la
// racine : une image unique et complète, une seule requête, aucun assemblage possible à mal tourner.
// Plafonnée à 1280px par côté (limite de l'API, vérifiée) : au-delà, l'image est demandée à cette
// taille puis mise à l'échelle sur le canevas cible — légère perte de netteté sur de très larges
// exports, largement préférable à des tuiles manquantes.
const fetchStaticBasemap = async (
  map: L.Map,
  styleId: string,
  token: string,
  targetWidthPx: number,
  targetHeightPx: number,
): Promise<HTMLImageElement | null> => {
  try {
    const bounds = map.getBounds();
    const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(',');

    const aspect = targetWidthPx / targetHeightPx || 1;
    let width = Math.min(MAPBOX_STATIC_MAX_DIMENSION, Math.round(targetWidthPx));
    let height = Math.round(width / aspect);
    if (height > MAPBOX_STATIC_MAX_DIMENSION) {
      height = MAPBOX_STATIC_MAX_DIMENSION;
      width = Math.round(height * aspect);
    }
    width = Math.max(1, width);
    height = Math.max(1, height);

    const url = `https://api.mapbox.com/styles/v1/${styleId}/static/[${bbox}]/${width}x${height}@2x?access_token=${token}`;
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('static image load failed'));
        img.src = objectUrl;
      });
      return img;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
};

// Point d'entrée du fond de carte : image statique Mapbox si disponible (fiable, voir plus haut),
// repli sur la recomposition depuis le DOM sinon (fond CARTO, ou requête Static Images en échec).
const buildTileCanvas = async (mapNode: HTMLElement, map: L.Map | null, scale: number): Promise<HTMLCanvasElement> => {
  const mapRect = mapNode.getBoundingClientRect();
  const targetWidth = Math.max(1, Math.round(mapRect.width * scale));
  const targetHeight = Math.max(1, Math.round(mapRect.height * scale));

  const mapboxSource = map ? detectMapboxStyleSource(mapNode) : null;
  if (map && mapboxSource) {
    const staticImage = await fetchStaticBasemap(map, mapboxSource.styleId, mapboxSource.token, targetWidth, targetHeight);
    if (staticImage) {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(staticImage, 0, 0, targetWidth, targetHeight);
        return canvas;
      }
    }
  }

  return compositeTileLayer(mapNode, scale);
};

export default function ExportPdfControl({
  mapRef,
  kind,
  circumstances,
  fileName,
  panelVisible,
  onTogglePanel,
  hasTrackedCities,
  terrainProfile,
  terrainTargetAltitudeDeg,
  terrainTargetAzimuthDeg,
  originName,
}: ExportPdfControlProps) {
  const [includeCircumstances, setIncludeCircumstances] = useState(true);
  const [includeCities, setIncludeCities] = useState(true);
  const [includeLegend, setIncludeLegend] = useState(false);
  const [includeHorizonProfile, setIncludeHorizonProfile] = useState(false);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const hasHorizonProfile =
    !!terrainProfile && terrainProfile.length > 0 && terrainTargetAltitudeDeg != null && terrainTargetAzimuthDeg != null;

  const handleExport = async () => {
    const mapNode = mapRef.current?.getContainer();
    if (!mapNode) return;

    setExporting(true);
    setExportError(null);
    try {
      // Démarré en parallèle de tout le reste (chargement d'un simple fichier statique, indépendant
      // du DOM de la carte) — le temps qu'on arrive à la composition finale du canevas, il est déjà prêt.
      const logoPromise = includeLogo ? loadLogoImage() : Promise.resolve(null);

      const [{ default: html2canvas }, { default: jsPDF }, pdfReport] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
        import('../helpers/pdfReport'),
      ]);

      // La molette de zoom est un contrôle d'UI, pas du contenu de carte : on la masque le temps de la capture.
      const zoomSlider = mapNode.querySelector<HTMLElement>('.eclipse-map__zoom-slider');
      const previousDisplay = zoomSlider?.style.display ?? '';
      if (zoomSlider) zoomSlider.style.display = 'none';

      const cityMarkers = Array.from(
        mapNode.querySelectorAll<HTMLElement>('.city-obscuration-marker, .city-visibility-marker'),
      );
      const previousCityDisplays = cityMarkers.map((el) => el.style.display);
      if (!includeCities) {
        cityMarkers.forEach((el) => {
          el.style.display = 'none';
        });
      }

      const horizonProfileElement =
        includeHorizonProfile && terrainProfile && terrainProfile.length > 0 && terrainTargetAltitudeDeg != null && terrainTargetAzimuthDeg != null
          ? buildHorizonProfileElement(terrainProfile, terrainTargetAltitudeDeg, terrainTargetAzimuthDeg, originName)
          : null;
      if (horizonProfileElement) mapNode.appendChild(horizonProfileElement);

      const legendElement = includeLegend ? buildLegendElement(kind, horizonProfileElement !== null) : null;
      if (legendElement) mapNode.appendChild(legendElement);

      if (mapRef.current) await waitForTileLayersToSettle(mapRef.current);
      await waitForTilesLoaded(mapNode);

      const mapRectForScale = mapNode.getBoundingClientRect();
      const scale = Math.min(MAX_EXPORT_SCALE, TARGET_MAP_WIDTH_PX / mapRectForScale.width);
      const tileCanvas = await buildTileCanvas(mapNode, mapRef.current, scale);

      // Masque le fond de carte le temps de la capture html2canvas, qui ne s'occupe plus que des
      // calques par-dessus (zones/lignes de visibilité, marqueurs, badges de villes, légende) — fond
      // transparent pour les superposer proprement sur tileCanvas juste après.
      const tilePane = mapNode.querySelector<HTMLElement>('.leaflet-tile-pane');
      const previousTilePaneDisplay = tilePane?.style.display ?? '';
      if (tilePane) tilePane.style.display = 'none';

      // Leaflet applique lui-même un fond gris (`.leaflet-container { background: #ddd }`) sur
      // mapNode — invisible normalement (caché sous les tuiles), mais dès que le calque de tuiles est
      // masqué ci-dessus, ce gris devient le fond réel du DOM. html2canvas le capture alors fidèlement
      // (comme n'importe quel style calculé), de façon OPAQUE, malgré `backgroundColor: null` — cette
      // option ne fait qu'éviter à html2canvas d'ajouter SON PROPRE fond par défaut, elle ne supprime
      // pas le vrai fond CSS de l'élément capturé. Résultat : ce gris opaque recouvrait ensuite tout
      // le fond de carte lors de la fusion finale des deux canevas (export uniformément gris malgré un
      // fond de carte correctement composé). Le forcer en transparent le temps de la capture règle ça.
      const previousBackground = mapNode.style.backgroundColor;
      mapNode.style.backgroundColor = 'transparent';

      let mapCanvas: HTMLCanvasElement;
      try {
        const overlayCanvas = await html2canvas(mapNode, {
          useCORS: true,
          allowTaint: false,
          imageTimeout: 15000,
          backgroundColor: null,
          scale,
        });

        mapCanvas = document.createElement('canvas');
        mapCanvas.width = tileCanvas.width;
        mapCanvas.height = tileCanvas.height;
        const ctx = mapCanvas.getContext('2d');
        if (!ctx) throw new Error('Impossible de créer le contexte de composition finale');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
        ctx.drawImage(tileCanvas, 0, 0);
        ctx.drawImage(overlayCanvas, 0, 0, mapCanvas.width, mapCanvas.height);

        const logo = await logoPromise;
        if (logo) drawLogoBadge(ctx, mapCanvas.width, scale, logo);
      } finally {
        if (tilePane) tilePane.style.display = previousTilePaneDisplay;
        mapNode.style.backgroundColor = previousBackground;
        if (zoomSlider) zoomSlider.style.display = previousDisplay;
        cityMarkers.forEach((el, index) => {
          el.style.display = previousCityDisplays[index];
        });
        legendElement?.remove();
        horizonProfileElement?.remove();
      }

      const mapAspect = mapCanvas.width / mapCanvas.height;
      const mapPageHeight = MAP_PAGE_WIDTH_MM / mapAspect;

      const doc = new jsPDF({
        orientation: mapAspect >= 1 ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [MAP_PAGE_WIDTH_MM, mapPageHeight],
        // Le PDF grossit nettement avec un PNG pleine résolution (voir addImage ci-dessous) — la
        // compression au niveau du conteneur PDF limite l'impact sur la taille du fichier final.
        compress: true,
      });
      // PNG plutôt que JPEG : sans perte, donc pas d'artefacts de compression sur les lignes/textes
      // fins de la carte (légende, badges de villes, lignes de visibilité) à pleine résolution
      // d'impression — le fichier est plus lourd, mais c'est le bon compromis pour un export destiné
      // aussi bien à l'impression qu'à un usage numérique en haute qualité.
      doc.addImage(mapCanvas.toDataURL('image/png'), 'PNG', 0, 0, MAP_PAGE_WIDTH_MM, mapPageHeight);

      if (includeCircumstances && circumstances) {
        doc.addPage([210, 297], 'portrait');
        // `logoPromise` est déjà résolu à ce stade (attendu une première fois plus haut pour le badge
        // de la page carte) — cet await renvoie donc la même image en cache, sans nouvelle requête.
        const logo = await logoPromise;
        if (circumstances.kind === 'solar') {
          pdfReport.drawSolarCircumstancesPage(doc, circumstances.params, logo);
        } else {
          pdfReport.drawLunarCircumstancesPage(doc, circumstances.params, logo);
        }
      }

      doc.save(`${fileName}.pdf`);
      onTogglePanel();
    } catch (error) {
      console.log('Error while generating PDF export', error);
      setExportError("L'export a échoué. Réessayez dans quelques instants.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="solar-eclipse-details__export-toggle">
        <SimpleButton
          icon={<Download size={18} color="#FFFFFF" />}
          onPress={onTogglePanel}
          backgroundColor="#000000"
          active
          activeBorderColor={panelVisible ? '#FFFFFF' : '#FFFFFF40'}
          title="Exporter en PDF"
        />
      </div>

      {panelVisible && <div className="solar-eclipse-details__capture-frame" />}

      {panelVisible && (
        <div className="solar-eclipse-details__export-panel">
          <label>
            <input
              type="checkbox"
              checked={includeCircumstances}
              disabled={!circumstances}
              onChange={(e) => setIncludeCircumstances(e.target.checked)}
            />
            <span>
              Inclure les circonstances locales
              {!circumstances && " (cliquez d'abord sur la carte)"}
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={includeCities}
              disabled={!hasTrackedCities}
              onChange={(e) => setIncludeCities(e.target.checked)}
            />
            <span>
              Afficher les villes suivies
              {!hasTrackedCities && ' (aucune ville suivie)'}
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={includeLegend}
              onChange={(e) => setIncludeLegend(e.target.checked)}
            />
            <span>Afficher la légende des lignes de visibilité</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={includeHorizonProfile}
              disabled={!hasHorizonProfile}
              onChange={(e) => setIncludeHorizonProfile(e.target.checked)}
            />
            <span>
              Afficher le profil de relief
              {!hasHorizonProfile && " (cliquez d'abord sur la carte)"}
            </span>
          </label>
          <label>
            <input type="checkbox" checked={includeLogo} onChange={(e) => setIncludeLogo(e.target.checked)} />
            <span>Afficher le logo Astroshare</span>
          </label>
          {exportError && <p className="solar-eclipse-details__export-error">{exportError}</p>}
          <SimpleButton
            text={exporting ? undefined : 'Exporter en PDF'}
            loading={exporting}
            onPress={handleExport}
            backgroundColor="#F4C23840"
            textColor="#F4C238"
          />
        </div>
      )}
    </>
  );
}
