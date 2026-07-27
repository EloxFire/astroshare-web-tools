import { useState, type RefObject } from 'react';
import { Download } from 'lucide-react';
import type L from 'leaflet';
import SimpleButton from './SimpleButton';
import type { SolarReportParams, LunarReportParams } from '../helpers/pdfReport';

export type CircumstancesPayload =
  | { kind: 'solar'; params: SolarReportParams }
  | { kind: 'lunar'; params: LunarReportParams };

interface ExportPdfControlProps {
  mapRef: RefObject<L.Map | null>;
  circumstances: CircumstancesPayload | null;
  fileName: string;
  panelVisible: boolean;
  onTogglePanel: () => void;
  hasTrackedCities: boolean;
}

const MAP_PAGE_WIDTH_MM = 297;

const isTileLoaded = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0;

// Attend que toutes les tuiles visibles aient fini de charger. Une tuile peut rester bloquée pour
// deux raisons : elle est simplement encore en vol (zone exportée large = beaucoup de tuiles), ou
// elle a été mise en cache par le navigateur sans les en-têtes CORS attendus par crossOrigin="anonymous"
// (typique quand la même tuile a été chargée ailleurs avant ce mode) — html2canvas la traite alors
// comme "tainted" et la laisse blanche. Dans les deux cas, forcer un rechargement avec une URL
// différente (cache-bust) et crossOrigin explicite règle le problème.
const waitForTilesLoaded = async (mapNode: HTMLElement, timeoutMs = 10000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const images = Array.from(mapNode.querySelectorAll('img'));
    if (images.length > 0 && images.every(isTileLoaded)) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  const stuck = Array.from(mapNode.querySelectorAll('img')).filter((img) => !isTileLoaded(img));
  if (stuck.length === 0) return;

  await Promise.all(
    stuck.map(
      (img) =>
        new Promise<void>((resolve) => {
          const cleanup = () => {
            img.removeEventListener('load', cleanup);
            img.removeEventListener('error', cleanup);
            resolve();
          };
          img.addEventListener('load', cleanup);
          img.addEventListener('error', cleanup);
          img.crossOrigin = 'anonymous';
          const baseUrl = img.src.split('?')[0];
          img.src = `${baseUrl}?cachebust=${Date.now()}`;
          setTimeout(cleanup, 6000);
        }),
    ),
  );
};

export default function ExportPdfControl({
  mapRef,
  circumstances,
  fileName,
  panelVisible,
  onTogglePanel,
  hasTrackedCities,
}: ExportPdfControlProps) {
  const [includeCircumstances, setIncludeCircumstances] = useState(true);
  const [includeCities, setIncludeCities] = useState(true);
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
