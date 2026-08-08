import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { useNextEclipse } from '../helpers/useNextEclipse';
import { getEclipseIconVariant } from '../helpers/eclipseTypeIcon';
import { solarEclipseTypes, lunarEclipseTypes } from '../constants';
import { sendWebStat } from '../api/sendWebStat';
import EclipseTypeIcon from './EclipseTypeIcon';
import './EclipseCountdownBanner.css';

dayjs.locale('fr');

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const getTimeLeft = (target: Date): TimeLeft | null => {
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return null;
  const totalSeconds = Math.floor(diffMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
};

const pad = (value: number) => value.toString().padStart(2, '0');

export default function EclipseCountdownBanner() {
  const { nextEclipse, loading } = useNextEclipse();
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    if (!nextEclipse) {
      setTimeLeft(null);
      return;
    }
    setTimeLeft(getTimeLeft(nextEclipse.targetDate));
    const interval = setInterval(() => setTimeLeft(getTimeLeft(nextEclipse.targetDate)), 1000);
    return () => clearInterval(interval);
  }, [nextEclipse]);

  if (loading) {
    return (
      <div className="eclipse-countdown eclipse-countdown--loading">
        <Loader2 size={18} className="eclipse-countdown__spinner" />
        <span>Recherche de la prochaine éclipse…</span>
      </div>
    );
  }

  if (!nextEclipse) return null;

  // Le décompte peut atteindre zéro alors que l'éclipse a lieu plus tard dans la même journée (heure
  // locale du visiteur vs instant UTC du maximum) : on affiche "aujourd'hui" plutôt que de masquer la
  // bannière tant qu'on est sur le jour calendaire de l'éclipse.
  const isToday = !timeLeft && dayjs(nextEclipse.targetDate).isSame(dayjs(), 'day');
  if (!timeLeft && !isToday) return null;

  const typeLabels = nextEclipse.kind === 'solar' ? solarEclipseTypes : lunarEclipseTypes;
  const typeLabel = typeLabels[nextEclipse.type] ?? (nextEclipse.kind === 'solar' ? 'Éclipse' : 'Éclipse');
  const label = `${typeLabel} de ${nextEclipse.kind === 'solar' ? 'Soleil' : 'Lune'}`;

  return (
    <Link
      to={`/${nextEclipse.kind}/${nextEclipse.urlDate}`}
      className="eclipse-countdown"
      onClick={() =>
        sendWebStat('countdown_banner_click', {
          eclipse: { kind: nextEclipse.kind, date: nextEclipse.calendarDate, type: nextEclipse.type },
        })
      }
    >
      <span className="eclipse-countdown__glow" aria-hidden="true">
        <EclipseTypeIcon
          kind={nextEclipse.kind}
          variant={getEclipseIconVariant(nextEclipse.kind, nextEclipse.type)}
          className="eclipse-countdown__icon"
        />
      </span>

      <span className="eclipse-countdown__info">
        <span className="eclipse-countdown__label">{label}</span>
        <span className="eclipse-countdown__date">{dayjs(nextEclipse.calendarDate).format('dddd DD MMMM YYYY')}</span>
      </span>

      {isToday || !timeLeft ? (
        <span className="eclipse-countdown__today">C'est aujourd'hui !</span>
      ) : (
        <span className="eclipse-countdown__timer">
          <span className="eclipse-countdown__unit">
            <strong>{timeLeft.days}</strong>
            <span>j</span>
          </span>
          <span className="eclipse-countdown__unit">
            <strong>{pad(timeLeft.hours)}</strong>
            <span>h</span>
          </span>
          <span className="eclipse-countdown__unit">
            <strong>{pad(timeLeft.minutes)}</strong>
            <span>min</span>
          </span>
          <span className="eclipse-countdown__unit">
            <strong>{pad(timeLeft.seconds)}</strong>
            <span>s</span>
          </span>
        </span>
      )}

      <ArrowRight size={20} className="eclipse-countdown__arrow" />
    </Link>
  );
}
