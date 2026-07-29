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

      let mapCanvas: HTMLCanvasElement;
      try {
        mapCanvas = await html2canvas(mapNode, {
          useCORS: true,
          allowTaint: false,
          imageTimeout: 15000,
          backgroundColor: '#000000',
          scale: Math.min(2, window.devicePixelRatio || 1),
        });
      } finally {
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
