// Génère la page "circonstances locales" du PDF exporté : contrairement à la page carte (qui reste
// une capture d'écran, la carte Leaflet n'étant pas vectorisable simplement), cette page est dessinée
// directement avec les primitives vectorielles de jsPDF (texte, lignes, rectangles) — pensée pour
// l'impression (fond clair, pas de dépendance à une capture DOM), et non plus une capture de la modale.
import type { jsPDF } from 'jspdf';
import dayjs from 'dayjs';
import type { SolarEclipse } from '../types/SolarEclipse';
import type { LunarEclipse } from '../types/LunarEclipse';
import { solarEclipseTypes, lunarEclipseTypes } from '../constants';
import { formatEventTime } from './formatTime';
import { equatorialToHorizontal } from './celestialPosition';

const PAGE_WIDTH = 210;
const MARGIN = 18;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = '#16181d';
const MUTED = '#70747c';
const ACCENT = '#b45309';
const LINE = '#dde1e6';
const FILL = '#f4f5f7';

const formatDuration = (value: string) => value.replace(':', 'h').replace(':', 'm') + 's';
const formatAngle = (value: number | null | undefined) => (value != null ? `${value.toFixed(2)}°` : '—');

type Location = { lat: number; lng: number };
type Dms = { lat: string; lon: string };

interface StatBox {
  label: string;
  value: string;
}

interface TableColumn {
  label: string;
  width: number;
  align?: 'left' | 'right';
}

// Petit, en haut de page, à opacité réduite — même traitement discret que le pied de page (voir
// drawFooter) : une marque de la source sans concurrencer le contenu (titre, tableaux).
const LOGO_WATERMARK_HEIGHT_MM = 6;
const LOGO_WATERMARK_Y_MM = 10;
const LOGO_WATERMARK_OPACITY = 0.3;

function drawLogoWatermark(doc: jsPDF, logo: HTMLImageElement) {
  const height = LOGO_WATERMARK_HEIGHT_MM;
  const width = height * (logo.naturalWidth / logo.naturalHeight);
  const x = PAGE_WIDTH - MARGIN - width;

  doc.saveGraphicsState();
  doc.setGState(doc.GState({ opacity: LOGO_WATERMARK_OPACITY }));
  doc.addImage(logo, 'PNG', x, LOGO_WATERMARK_Y_MM, width, height);
  doc.restoreGraphicsState();
}

function drawHeader(doc: jsPDF, dateLabel: string, typeLabel: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.setTextColor(INK);
  doc.text(dateLabel.toUpperCase(), MARGIN, 26);

  doc.setFontSize(11);
  doc.setTextColor(ACCENT);
  doc.text(typeLabel.toUpperCase(), MARGIN, 33, { charSpace: 0.4 });

  doc.setDrawColor(LINE);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, 39, PAGE_WIDTH - MARGIN, 39);

  return 39;
}

function drawLocationLine(doc: jsPDF, y: number, locationName: string, dms: Dms, timeLabel: string): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(INK);
  const label = locationName ? `${locationName} — ${dms.lat} ${dms.lon}` : `${dms.lat} ${dms.lon}`;
  doc.text(label, MARGIN, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(ACCENT);
  doc.text(timeLabel.toUpperCase(), PAGE_WIDTH - MARGIN, y + 9, { align: 'right', charSpace: 0.3 });

  return y + 9;
}

function drawStatBoxes(doc: jsPDF, y: number, stats: StatBox[]): number {
  const gap = 6;
  const boxWidth = (CONTENT_WIDTH - gap * (stats.length - 1)) / stats.length;
  const boxHeight = 20;
  const top = y + 8;

  stats.forEach((stat, index) => {
    const x = MARGIN + index * (boxWidth + gap);
    doc.setDrawColor(LINE);
    doc.setFillColor(FILL);
    doc.roundedRect(x, top, boxWidth, boxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED);
    doc.text(stat.label.toUpperCase(), x + 5, top + 8, { charSpace: 0.2 });

    doc.setFont('courier', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(INK);
    doc.text(stat.value, x + 5, top + 16);
  });

  return top + boxHeight;
}

function drawTable(doc: jsPDF, y: number, columns: TableColumn[], rows: string[][]): number {
  const rowHeight = 9;
  const headerHeight = 8;
  let cursorX = MARGIN;
  const colX = columns.map((col) => {
    const x = cursorX;
    cursorX += col.width;
    return x;
  });

  doc.setFillColor(FILL);
  doc.rect(MARGIN, y, CONTENT_WIDTH, headerHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  columns.forEach((col, index) => {
    const align = col.align ?? 'left';
    const x = align === 'right' ? colX[index] + col.width - 3 : colX[index] + 3;
    doc.text(col.label.toUpperCase(), x, y + 5.6, { align, charSpace: 0.2 });
  });

  let rowY = y + headerHeight;
  doc.setFont('courier', 'normal');
  doc.setFontSize(9.5);
  rows.forEach((row) => {
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, rowY + rowHeight, MARGIN + CONTENT_WIDTH, rowY + rowHeight);

    row.forEach((cell, index) => {
      const align = columns[index].align ?? 'left';
      const x = align === 'right' ? colX[index] + columns[index].width - 3 : colX[index] + 3;
      doc.setTextColor(index === 0 ? INK : INK);
      doc.setFont(index === 0 ? 'helvetica' : 'courier', index === 0 ? 'bold' : 'normal');
      doc.text(cell, x, rowY + 6.2, { align });
    });
    rowY += rowHeight;
  });

  doc.setDrawColor(LINE);
  doc.rect(MARGIN, y, CONTENT_WIDTH, rowY - y);

  return rowY;
}

function drawTermsLegend(doc: jsPDF, y: number, text: string): number {
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH) as string[];
  doc.text(lines, MARGIN, y + 6);
  return y + 6 + (lines.length - 1) * 4;
}

function drawSectionTitle(doc: jsPDF, y: number, title: string, note: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(INK);
  doc.text(title, MARGIN, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED);
  doc.text(note, MARGIN, y + 15);
  return y + 15;
}

function drawPhaseLegend(doc: jsPDF, y: number, points: { label: string; time: string }[]): number {
  const text = points.map((p) => `${p.label} ${p.time}`).join('   ·   ');
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED);
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH) as string[];
  lines.forEach((line, index) => {
    doc.text(line, PAGE_WIDTH / 2, y + 4 + index * 4, { align: 'center' });
  });
  return y + 4 + (lines.length - 1) * 4;
}

function drawFooter(doc: jsPDF) {
  const y = 285;
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED);
  doc.text(
    "Données Astroshare (éphémérides IMCCE) — document généré à titre indicatif, à vérifier avant observation.",
    MARGIN,
    y + 5,
  );
  doc.text(dayjs().format('DD/MM/YYYY HH:mm'), PAGE_WIDTH - MARGIN, y + 5, { align: 'right' });
}

// --- Diagramme trajectoire (solaire) : port fidèle de la géométrie de MoonPathDiagram.tsx, dans le
// repère local (celui que ce composant affiche par défaut) plutôt que le repère céleste : l'angle
// utilisé est `zenith` (l'orientation telle qu'un observateur la voit réellement dans le ciel, "haut"
// = zénith) et non `p` (angle de position, mesuré depuis le pôle céleste) — sans quoi la trajectoire
// tracée ne correspond pas à ce qui est visuellement observable depuis le sol. ---
type SolarPhaseKey = 'P1' | 'U1' | 'greatest' | 'U4' | 'P4';
const SOLAR_PHASES: { key: SolarPhaseKey; label: string; contact: 'external' | 'internal' | 'greatest' }[] = [
  { key: 'P1', label: 'P1', contact: 'external' },
  { key: 'U1', label: 'O1', contact: 'internal' },
  { key: 'greatest', label: 'M', contact: 'greatest' },
  { key: 'U4', label: 'O4', contact: 'internal' },
  { key: 'P4', label: 'P4', contact: 'external' },
];

function drawMoonPathDiagram(doc: jsPDF, y: number, data: SolarEclipse, useLocalTime: boolean): number {
  const available = SOLAR_PHASES.filter(({ key }) => data.events[key]);
  const sectionTop = drawSectionTitle(
    doc,
    y,
    'Trajectoire de la Lune',
    'Diagramme schématique (tailles et positions approximatives) — repère local',
  );
  if (available.length === 0) return sectionTop;

  const boxWidth = CONTENT_WIDTH;
  const boxHeight = 74;
  const top = sectionTop + 12;
  const centerX = MARGIN + boxWidth / 2;
  const centerY = top + boxHeight / 2;
  const sunRadiusMm = 17;

  doc.setDrawColor(LINE);
  doc.setFillColor('#eef1f6');
  doc.roundedRect(MARGIN, top, boxWidth, boxHeight, 2, 2, 'FD');

  const referenceEvent = data.events.P1 ?? data.events.greatest ?? data.events[available[0].key]!;
  const pxPerDeg = sunRadiusMm / referenceEvent.Sun.radius;

  const points = available.map(({ key, label, contact }) => {
    const event = data.events[key]!;
    const sunR = event.Sun.radius;
    const moonR = event.Moon.radius;
    let separation: number;
    if (contact === 'external') separation = sunR + moonR;
    else if (contact === 'internal') separation = Math.abs(sunR - moonR);
    else separation = Math.max(0, Math.min(sunR + moonR, sunR + moonR - 2 * data.magnitude * sunR));

    const angleRad = (event.zenith ?? 0) * (Math.PI / 180);
    const dx = Math.sin(angleRad) * separation * pxPerDeg;
    const dy = -Math.cos(angleRad) * separation * pxPerDeg;
    return { label, x: centerX + dx, y: centerY + dy, r: moonR * pxPerDeg, time: formatEventTime(event.date, useLocalTime) };
  });

  // trajectoire
  doc.setDrawColor('#9aa1ad');
  doc.setLineDashPattern([1, 1], 0);
  doc.setLineWidth(0.3);
  for (let i = 0; i < points.length - 1; i++) {
    doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
  }
  doc.setLineDashPattern([], 0);

  // soleil
  doc.setFillColor('#f4c238');
  doc.setDrawColor('#c99a1e');
  doc.circle(centerX, centerY, sunRadiusMm, 'FD');

  // lune à chaque phase
  points.forEach((p) => {
    doc.setFillColor('#d7dbe2');
    doc.setDrawColor('#8b93a1');
    doc.setLineWidth(0.25);
    doc.circle(p.x, p.y, Math.max(p.r, 1.2), 'FD');
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(INK);
    doc.text(p.label, p.x, p.y - Math.max(p.r, 1.2) - 2, { align: 'center' });
  });

  return drawPhaseLegend(doc, top + boxHeight, points);
}

// --- Diagramme trajectoire dans l'ombre (lunaire) : port fidèle de MoonShadowDiagram.tsx ---
type LunarPhaseKey = 'P1' | 'U1' | 'U2' | 'greatest' | 'U3' | 'U4' | 'P2';
const LUNAR_PHASES: { key: LunarPhaseKey; label: string }[] = [
  { key: 'P1', label: 'P1' },
  { key: 'U1', label: 'U1' },
  { key: 'U2', label: 'U2' },
  { key: 'greatest', label: 'M' },
  { key: 'U3', label: 'U3' },
  { key: 'U4', label: 'U4' },
  { key: 'P2', label: 'P2' },
];
const LUNAR_ANGLE_OFFSET: Partial<Record<LunarPhaseKey, number>> = { U2: 180, greatest: 180, U3: 180 };

function drawMoonShadowDiagram(doc: jsPDF, y: number, data: LunarEclipse, useLocalTime: boolean): number {
  const available = LUNAR_PHASES.filter(({ key }) => data.events[key]);
  const sectionTop = drawSectionTitle(
    doc,
    y,
    "Trajectoire dans l'ombre de la Terre",
    'Cercle extérieur = pénombre, cercle intérieur = ombre (échelle réelle)',
  );
  if (available.length === 0) return sectionTop;

  const boxWidth = CONTENT_WIDTH;
  const boxHeight = 78;
  const top = sectionTop + 12;
  const centerX = MARGIN + boxWidth / 2;
  const centerY = top + boxHeight / 2;
  const penumbraRadiusMm = 25;

  doc.setDrawColor(LINE);
  doc.setFillColor('#eef1f6');
  doc.roundedRect(MARGIN, top, boxWidth, boxHeight, 2, 2, 'FD');

  const pxPerUnit = penumbraRadiusMm / data.radius.penumbra;
  const umbraRadiusMm = data.radius.umbra * pxPerUnit;

  const points = available.map(({ key, label }) => {
    const event = data.events[key]!;
    const angleDeg = (event.p ?? 0) + (LUNAR_ANGLE_OFFSET[key] ?? 0);
    const angleRad = (angleDeg * Math.PI) / 180;
    const separation = event.axis * pxPerUnit;
    const dx = Math.sin(angleRad) * separation;
    const dy = -Math.cos(angleRad) * separation;
    return {
      label,
      x: centerX + dx,
      y: centerY + dy,
      r: event.Moon.radius * pxPerUnit,
      time: formatEventTime(event.date, useLocalTime),
    };
  });

  doc.setDrawColor('#9aa1ad');
  doc.setLineDashPattern([1, 1], 0);
  doc.setLineWidth(0.3);
  for (let i = 0; i < points.length - 1; i++) {
    doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
  }
  doc.setLineDashPattern([], 0);

  doc.setFillColor('#c9cfd8');
  doc.setDrawColor('#8b93a1');
  doc.setLineWidth(0.25);
  doc.circle(centerX, centerY, penumbraRadiusMm, 'FD');
  doc.setFillColor('#4b5563');
  doc.circle(centerX, centerY, umbraRadiusMm, 'FD');

  points.forEach((p) => {
    doc.setFillColor('#f4c238');
    doc.setDrawColor('#c99a1e');
    doc.setLineWidth(0.25);
    doc.circle(p.x, p.y, Math.max(p.r, 1.2), 'FD');
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(INK);
    doc.text(p.label, p.x, p.y - Math.max(p.r, 1.2) - 2, { align: 'center' });
  });

  return drawPhaseLegend(doc, top + boxHeight, points);
}

export interface SolarReportParams {
  eclipse: SolarEclipse;
  data: SolarEclipse;
  locationName: string;
  dms: Dms;
  useLocalTime: boolean;
}

export function drawSolarCircumstancesPage(doc: jsPDF, params: SolarReportParams, logo: HTMLImageElement | null) {
  const { eclipse, data, locationName, dms, useLocalTime } = params;

  if (logo) drawLogoWatermark(doc, logo);
  let y = drawHeader(doc, dayjs(eclipse.calendarDate).format('dddd DD MMMM YYYY'), solarEclipseTypes[data.type] ?? data.type);
  y = drawLocationLine(doc, y, locationName, dms, useLocalTime ? 'Heure locale' : 'UTC');

  const stats: StatBox[] = [];
  if (data.duration.umbral) stats.push({ label: 'Durée phase totale', value: formatDuration(data.duration.umbral) });
  stats.push({ label: "Durée de l'éclipse", value: formatDuration(data.duration.penumbral) });
  stats.push({ label: 'Magnitude', value: String(data.magnitude) });
  if (data.obscuration != null) stats.push({ label: 'Obscuration', value: `${data.obscuration}%` });
  y = drawStatBoxes(doc, y, stats);

  const rows = SOLAR_PHASES.filter(({ key }) => data.events[key]).map(({ key, label }) => {
    const event = data.events[key]!;
    return [label, formatEventTime(event.date, useLocalTime), formatAngle(event.p), formatAngle(event.zenith), formatAngle(event.Sun.elevation)];
  });
  y =
    drawTable(
      doc,
      y + 10,
      [
        { label: 'Phase', width: 26 },
        { label: 'Heure', width: 40 },
        { label: 'P', width: 36, align: 'right' },
        { label: 'Z', width: 36, align: 'right' },
        { label: 'H Soleil', width: CONTENT_WIDTH - 26 - 40 - 36 - 36, align: 'right' },
      ],
      rows,
    ) + 4;
  y = drawTermsLegend(
    doc,
    y,
    'P : angle de position (référence céleste) · Z : angle au zénith · H Soleil : hauteur du Soleil au-dessus de l’horizon.',
  );

  drawMoonPathDiagram(doc, y + 4, data, useLocalTime);
  drawFooter(doc);
}

export interface LunarReportParams {
  eclipse: LunarEclipse;
  locationName: string;
  dms: Dms;
  location: Location;
  useLocalTime: boolean;
}

export function drawLunarCircumstancesPage(doc: jsPDF, params: LunarReportParams, logo: HTMLImageElement | null) {
  const { eclipse, locationName, dms, location, useLocalTime } = params;

  if (logo) drawLogoWatermark(doc, logo);
  let y = drawHeader(
    doc,
    dayjs(eclipse.calendarDate).format('dddd DD MMMM YYYY'),
    lunarEclipseTypes[eclipse.type] ?? eclipse.type,
  );
  y = drawLocationLine(doc, y, locationName, dms, useLocalTime ? 'Heure locale' : 'UTC');

  const stats: StatBox[] = [];
  if (eclipse.duration.total) stats.push({ label: 'Durée phase totale', value: formatDuration(eclipse.duration.total) });
  if (eclipse.duration.partial) stats.push({ label: 'Durée phase partielle', value: formatDuration(eclipse.duration.partial) });
  stats.push({ label: 'Durée pénombrale', value: formatDuration(eclipse.duration.penumbral) });
  stats.push({ label: 'Magnitude', value: String(eclipse.magnitude) });
  y = drawStatBoxes(doc, y, stats);

  const rows = LUNAR_PHASES.filter(({ key }) => eclipse.events[key]).map(({ key, label }) => {
    const event = eclipse.events[key]!;
    const { altitude } = equatorialToHorizontal(event.date, event.Moon.RA, event.Moon.DEC, location.lat, location.lng);
    return [label, formatEventTime(event.date, useLocalTime), `${altitude.toFixed(1)}°`, altitude > 0 ? 'Oui' : 'Non'];
  });
  y =
    drawTable(
      doc,
      y + 10,
      [
        { label: 'Phase', width: 30 },
        { label: 'Heure', width: 46 },
        { label: 'Altitude Lune', width: 50, align: 'right' },
        { label: 'Visible', width: CONTENT_WIDTH - 30 - 46 - 50, align: 'right' },
      ],
      rows,
    ) + 4;

  drawMoonShadowDiagram(doc, y + 6, eclipse, useLocalTime);
  drawFooter(doc);
}
