import { useState, type RefObject } from 'react';
import { Download } from 'lucide-react';
import L from 'leaflet';
import SimpleButton from './SimpleButton';
import { SOLAR_LEGEND, LUNAR_LEGEND } from './VisibilityLegend';
import type { SolarReportParams, LunarReportParams } from '../helpers/pdfReport';

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
}

const buildLegendElement = (kind: 'solar' | 'lunar'): HTMLElement => {
  const entries = kind === 'solar' ? SOLAR_LEGEND : LUNAR_LEGEND;
  const wrapper = document.createElement('div');
  wrapper.className = 'solar-eclipse-details__export-legend-corner';
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

const MAP_PAGE_WIDTH_MM = 297;

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
}: ExportPdfControlProps) {
  const [includeCircumstances, setIncludeCircumstances] = useState(true);
  const [includeCities, setIncludeCities] = useState(true);
  const [includeLegend, setIncludeLegend] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    const mapNode = mapRef.current?.getContainer();
    if (!mapNode) return;

    setExporting(true);
    setExportError(null);
    try {
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

      const legendElement = includeLegend ? buildLegendElement(kind) : null;
      if (legendElement) mapNode.appendChild(legendElement);

      if (mapRef.current) await waitForTileLayersToSettle(mapRef.current);
      await waitForTilesLoaded(mapNode);

      const scale = Math.min(2, window.devicePixelRatio || 1);
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
      } finally {
        if (tilePane) tilePane.style.display = previousTilePaneDisplay;
        mapNode.style.backgroundColor = previousBackground;
        if (zoomSlider) zoomSlider.style.display = previousDisplay;
        cityMarkers.forEach((el, index) => {
          el.style.display = previousCityDisplays[index];
        });
        legendElement?.remove();
      }

      const mapAspect = mapCanvas.width / mapCanvas.height;
      const mapPageHeight = MAP_PAGE_WIDTH_MM / mapAspect;

      const doc = new jsPDF({
        orientation: mapAspect >= 1 ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [MAP_PAGE_WIDTH_MM, mapPageHeight],
      });
      doc.addImage(mapCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, MAP_PAGE_WIDTH_MM, mapPageHeight);

      if (includeCircumstances && circumstances) {
        doc.addPage([210, 297], 'portrait');
        if (circumstances.kind === 'solar') {
          pdfReport.drawSolarCircumstancesPage(doc, circumstances.params);
        } else {
          pdfReport.drawLunarCircumstancesPage(doc, circumstances.params);
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
