// Format d'URL : DD-MM-YYYY (ex: 12-06-2026). Format API (calendarDate) : YYYY-MM-DD (ISO).

export const isoToUrlDate = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
};

const URL_DATE_PATTERN = /^(\d{2})-(\d{2})-(\d{4})$/;

export const urlDateToIso = (urlDate: string): string | null => {
  const match = URL_DATE_PATTERN.exec(urlDate);
  if (!match) return null;
  const [, d, m, y] = match;
  return `${y}-${m}-${d}`;
};

export const yearFromUrlDate = (urlDate: string): string | null => {
  const match = URL_DATE_PATTERN.exec(urlDate);
  return match ? match[3] : null;
};
