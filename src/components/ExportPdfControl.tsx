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
}

const MAP_PAGE_WIDTH_MM = 297;

// Attend que toutes les tuiles de la carte visibles à l'écran aient fini de charger : sans ça, une
// capture lancée trop tôt (ou une tuile encore en cache sans CORS) peut produire une carte blanche
// ou faire échouer toDataURL (canvas "tainted"). On retente un court instant plutôt que d'abandonner.
const waitForTilesLoaded = async (mapNode: HTMLElement, timeoutMs = 4000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const images = Array.from(mapNode.querySelectorAll('img'));
    if (images.length > 0 && images.every((img) => img.complete && img.naturalWidth > 0)) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
};

export default function ExportPdfControl({
  mapRef,
  circumstances,
  fileName,
  panelVisible,
  onTogglePanel,
}: ExportPdfControlProps) {
  const [includeCircumstances, setIncludeCircumstances] = useState(true);
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
