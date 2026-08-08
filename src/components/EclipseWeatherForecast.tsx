import { useEffect, useState } from 'react';
import { Cloud, Droplets, Loader2, Thermometer, Wind } from 'lucide-react';
import dayjs from 'dayjs';
import { getWeatherForecast } from '../api/getWeatherForecast';
import { matchWeatherToEclipse, getHourlyWindow, type EclipseWeatherMatch } from '../helpers/matchWeatherToEclipse';
import { getCloudCoverRating } from '../helpers/cloudCoverRating';
import { getWeatherIconUrl } from '../helpers/weatherIcon';
import { azimuthToCompassAbbreviation } from '../helpers/visibilityRating';
import type { HourlyWeather } from '../types/Weather';
import './EclipseWeatherForecast.css';

interface EclipseWeatherForecastProps {
  location: { lat: number; lng: number };
  // Date d'un évènement de l'éclipse (ex: le maximum) au format renvoyé par l'API, UTC sans 'Z' —
  // sert de référence pour trouver la prévision la plus proche (voir matchWeatherToEclipse.ts).
  eventDateIsoNoZ: string;
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; match: EclipseWeatherMatch };

const capitalize = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

// OpenWeather renvoie `wind_speed` en m/s même en `units=metric` (seule la température suit vraiment
// le système métrique) — conversion explicite pour afficher des km/h, contrairement à l'app mobile qui
// affiche la valeur brute sous cette unité sans la convertir.
const windSpeedToKmh = (metersPerSecond: number) => Math.round(metersPerSecond * 3.6);

export default function EclipseWeatherForecast({ location, eventDateIsoNoZ }: EclipseWeatherForecastProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    getWeatherForecast(location.lat, location.lng)
      .then((forecast) => {
        if (!cancelled) setState({ status: 'ready', match: matchWeatherToEclipse(forecast, eventDateIsoNoZ) });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, [location.lat, location.lng, eventDateIsoNoZ]);

  // Un titre de section fixe (voir plus bas) identifie le bloc quel que soit son état — le rendu
  // conditionnel ci-dessous ne construit donc plus que son contenu, jamais son propre conteneur.
  if (state.status === 'loading') {
    return (
      <section className="eclipse-weather-forecast">
        <EclipseWeatherSectionTitle />
        <div className="eclipse-weather-forecast--message">
          <Loader2 size={14} className="eclipse-weather-forecast__spinner" />
          <p>Récupération des prévisions météo…</p>
        </div>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className="eclipse-weather-forecast">
        <EclipseWeatherSectionTitle />
        <div className="eclipse-weather-forecast--message">
          <p>Prévisions météo indisponibles pour le moment.</p>
        </div>
      </section>
    );
  }

  const { match } = state;

  if (match.status === 'unavailable') {
    if (match.reason === 'past') return null;
    const days = match.daysUntilAvailable;
    return (
      <section className="eclipse-weather-forecast">
        <EclipseWeatherSectionTitle />
        <div className="eclipse-weather-forecast--message">
          <p>
            Prévisions météo pas encore disponibles pour cette éclipse{days > 0 ? ` (encore environ ${days} jour${days > 1 ? 's' : ''} à attendre)` : ''} :
            la météo affichée dans l'app provient d'un service en direct, sans prévision à très long terme. Les
            prévisions jour par jour arrivent à partir de J-8 (8 jours avant l'éclipse), le détail heure par heure à
            partir de H-48 (48h avant).
          </p>
        </div>
      </section>
    );
  }

  const condition = match.entry.weather[0];
  const clouds = Math.round(match.entry.clouds);
  const pop = Math.round(match.entry.pop * 100);
  const temp = Math.round(match.status === 'hourly' ? match.entry.temp : match.entry.temp.day);
  const windKmh = windSpeedToKmh(match.entry.wind_speed);
  const windDirection = azimuthToCompassAbbreviation(match.entry.wind_deg);
  const rating = getCloudCoverRating(clouds);
  const hourlyWindow = match.status === 'hourly' ? getHourlyWindow(match.hourly, match.entry) : null;
  // "Jour J" seulement confirmé si la date calendaire (UTC) de l'entrée retenue correspond bien à
  // celle de l'éclipse — la mise en correspondance ("l'entrée la plus proche", voir
  // matchWeatherToEclipse.ts) peut exceptionnellement retomber sur le jour suivant/précédent près de
  // minuit UTC : mieux vaut alors ne rien afficher que d'induire en erreur.
  const isDayOfEclipse = eventDateIsoNoZ.slice(0, 10) === new Date(match.entry.dt * 1000).toISOString().slice(0, 10);

  return (
    <section className="eclipse-weather-forecast">
      <EclipseWeatherSectionTitle />
      <div className="eclipse-weather-forecast__header">
        <div className="eclipse-weather-forecast__icon-wrap" style={{ background: `${rating.color}26`, borderColor: `${rating.color}55` }}>
          {condition && (
            <img
              src={getWeatherIconUrl(condition.icon)}
              alt=""
              className="eclipse-weather-forecast__icon"
            />
          )}
        </div>
        <div className="eclipse-weather-forecast__heading">
          <div className="eclipse-weather-forecast__title-row">
            <p className="eclipse-weather-forecast__condition">{condition ? capitalize(condition.description) : 'Prévision météo'}</p>
            <span className="eclipse-weather-forecast__badge" style={{ background: `${rating.color}30`, color: rating.color }}>
              {rating.verdict}
            </span>
          </div>
          <p className="eclipse-weather-forecast__caption">
            {match.status === 'hourly'
              ? "Prévision horaire, proche du maximum de l'éclipse"
              : "Prévision journalière (moyenne du jour) : le maximum de l'éclipse est encore à plusieurs jours"}
          </p>
        </div>
      </div>

      {isDayOfEclipse && <p className="eclipse-weather-forecast__day-label">Prévision du jour J</p>}

      <div className="eclipse-weather-forecast__stats">
        <div className="eclipse-weather-forecast__stat">
          <span>
            <Cloud size={12} /> Nuages
          </span>
          <strong style={{ color: rating.color }}>{clouds}%</strong>
        </div>
        <div className="eclipse-weather-forecast__stat">
          <span>
            <Thermometer size={12} /> Température
          </span>
          <strong>{temp}°C</strong>
        </div>
        <div className="eclipse-weather-forecast__stat">
          <span>
            <Droplets size={12} /> Précipitations
          </span>
          <strong>{pop}%</strong>
        </div>
        <div className="eclipse-weather-forecast__stat">
          <span>
            <Wind size={12} /> Vent
          </span>
          <strong>{windKmh} km/h</strong>
          <em>{windDirection}</em>
        </div>
      </div>

      {hourlyWindow && hourlyWindow.length > 1 && (
        <div className="eclipse-weather-forecast__hourly">
          <p className="eclipse-weather-forecast__hourly-title">Heure par heure</p>
          <div className="eclipse-weather-forecast__hourly-track">
            {hourlyWindow.map((hour) => (
              <HourChip key={hour.dt} hour={hour} active={hour.dt === match.entry.dt} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function EclipseWeatherSectionTitle() {
  return (
    <>
      <h3 className="eclipse-weather-forecast__title">Prévisions météo</h3>
      <p className="eclipse-weather-forecast__note">Conditions prévues au moment de l'éclipse, depuis ce lieu</p>
    </>
  );
}

interface HourChipProps {
  hour: HourlyWeather;
  // Repère visuellement l'heure retenue comme référence pour la carte principale ci-dessus, parmi
  // toutes celles de la bande — sans ça, rien ne relie les deux au premier coup d'œil.
  active: boolean;
}

function HourChip({ hour, active }: HourChipProps) {
  const condition = hour.weather[0];
  const rating = getCloudCoverRating(Math.round(hour.clouds));
  return (
    <div className={`eclipse-weather-forecast__hour-chip${active ? ' eclipse-weather-forecast__hour-chip--active' : ''}`}>
      <span className="eclipse-weather-forecast__hour-time">{dayjs.unix(hour.dt).format('HH[h]mm')}</span>
      {condition && <img src={getWeatherIconUrl(condition.icon)} alt="" className="eclipse-weather-forecast__hour-icon" />}
      <strong className="eclipse-weather-forecast__hour-temp">{Math.round(hour.temp)}°</strong>
      <span className="eclipse-weather-forecast__hour-clouds" style={{ color: rating.color }}>
        {Math.round(hour.clouds)}%
      </span>
      <span className="eclipse-weather-forecast__hour-wind">
        {windSpeedToKmh(hour.wind_speed)} {azimuthToCompassAbbreviation(hour.wind_deg)}
      </span>
    </div>
  );
}
