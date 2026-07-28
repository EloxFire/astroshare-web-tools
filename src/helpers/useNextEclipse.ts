import { useEffect, useState } from 'react';
import { astroshareApi } from '../api/astroshareApi';
import { isoToUrlDate } from './dateFormat';
import type { SolarEclipse } from '../types/SolarEclipse';
import type { LunarEclipse } from '../types/LunarEclipse';

export interface NextEclipse {
  kind: 'solar' | 'lunar';
  type: string;
  calendarDate: string;
  targetDate: Date;
  urlDate: string;
}

// Moment précis à comparer : l'instant du maximum de l'éclipse si connu, sinon midi UTC du jour de
// l'éclipse à défaut (ne devrait arriver que si l'API ne renvoie pas `events.greatest`).
// Les dates de l'API sont des horaires UTC sans suffixe 'Z' (voir formatTime.ts) : il faut l'ajouter
// pour que `Date` les interprète comme un instant UTC réel plutôt que comme une heure locale.
const eventDate = (eclipse: SolarEclipse | LunarEclipse): Date =>
  new Date(eclipse.events.greatest?.date ? `${eclipse.events.greatest.date}Z` : `${eclipse.calendarDate}T12:00:00Z`);

const findNextInYear = async <T extends SolarEclipse | LunarEclipse>(
  path: string,
  year: number,
  now: Date,
): Promise<T | null> => {
  try {
    const response = await astroshareApi.get(path, { params: { year } });
    const data: T[] = response.data ?? [];
    const upcoming = data
      .filter((eclipse) => eventDate(eclipse).getTime() >= now.getTime())
      .sort((a, b) => eventDate(a).getTime() - eventDate(b).getTime());
    return upcoming[0] ?? null;
  } catch {
    return null;
  }
};

// Repli sur l'année suivante si plus aucune éclipse de ce type ne reste dans l'année en cours (ex :
// on est fin décembre et la prochaine éclipse solaire est en janvier prochain).
const findNextOfKind = async <T extends SolarEclipse | LunarEclipse>(path: string, now: Date): Promise<T | null> => {
  const currentYear = now.getFullYear();
  const thisYear = await findNextInYear<T>(path, currentYear, now);
  return thisYear ?? findNextInYear<T>(path, currentYear + 1, now);
};

// Cherche la prochaine éclipse à venir, solaire ou lunaire, en comparant leurs deux prochaines
// occurrences respectives et en gardant la plus proche dans le temps.
export const useNextEclipse = () => {
  const [nextEclipse, setNextEclipse] = useState<NextEclipse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const now = new Date();
      const [nextSolar, nextLunar] = await Promise.all([
        findNextOfKind<SolarEclipse>('/eclipses/solar', now),
        findNextOfKind<LunarEclipse>('/eclipses/lunar', now),
      ]);
      if (cancelled) return;

      const candidates = (
        [
          nextSolar && { kind: 'solar' as const, eclipse: nextSolar },
          nextLunar && { kind: 'lunar' as const, eclipse: nextLunar },
        ].filter(Boolean) as { kind: 'solar' | 'lunar'; eclipse: SolarEclipse | LunarEclipse }[]
      )
        .map((candidate) => ({ ...candidate, date: eventDate(candidate.eclipse) }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      const winner = candidates[0];
      setNextEclipse(
        winner
          ? {
              kind: winner.kind,
              type: winner.eclipse.type,
              calendarDate: winner.eclipse.calendarDate,
              targetDate: winner.date,
              urlDate: isoToUrlDate(winner.eclipse.calendarDate),
            }
          : null,
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { nextEclipse, loading };
};
