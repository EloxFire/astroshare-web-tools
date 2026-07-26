import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { astroshareApi } from '../api/astroshareApi';
import { solarEclipseTypes, lunarEclipseTypes } from '../constants';
import { isoToUrlDate } from '../helpers/dateFormat';
import SimpleButton from '../components/SimpleButton';
import SolarSafetyDisclaimer from '../components/SolarSafetyDisclaimer';
import './EclipseYearPicker.css';

dayjs.locale('fr');

interface EclipseCandidate {
  calendarDate: string;
  type: string;
  magnitude: number;
  duration: { penumbral: string };
  link?: { image?: string };
}

interface EclipseYearPickerProps {
  kind: 'solar' | 'lunar';
}

const titles: Record<'solar' | 'lunar', string> = {
  solar: "Circonstances d'éclipse solaire",
  lunar: "Circonstances d'éclipse lunaire",
};

const formatDuration = (duration: string) => duration.replace(':', 'h').replace(':', 'm') + 's';

export default function EclipseYearPicker({ kind }: EclipseYearPickerProps) {
  const navigate = useNavigate();
  const typeLabels = kind === 'solar' ? solarEclipseTypes : lunarEclipseTypes;

  const [yearInput, setYearInput] = useState(String(new Date().getFullYear()));
  const [candidates, setCandidates] = useState<EclipseCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    setLoading(true);
    setError(null);
    setCandidates([]);
    try {
      const response = await astroshareApi.get(`/eclipses/${kind}`, { params: { year: yearInput } });
      const data: EclipseCandidate[] = response.data;
      if (!data?.length) {
        setError('Aucune éclipse trouvée pour cette année');
        return;
      }
      if (data.length === 1) {
        navigate(`/${kind}/${isoToUrlDate(data[0].calendarDate)}`);
        return;
      }
      setCandidates(data);
    } catch {
      setError('Erreur lors de la récupération des données');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="eclipse-year-picker">
      <Link to="/" className="eclipse-year-picker__back">
        ← Retour
      </Link>
      <h1>{titles[kind]}</h1>
      <p>Entrez une année pour afficher l'éclipse correspondante.</p>

      {kind === 'solar' && <SolarSafetyDisclaimer />}

      <div className="eclipse-year-picker__form">
        <input
          className="eclipse-year-picker__input"
          value={yearInput}
          onChange={(e) => setYearInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Année (ex: 2026)"
          inputMode="numeric"
        />
        <SimpleButton
          text={loading ? undefined : 'Rechercher'}
          loading={loading}
          onPress={search}
          backgroundColor="#F4C23840"
          textColor="#F4C238"
        />
      </div>

      {error && <p className="eclipse-year-picker__error">{error}</p>}

      {candidates.length > 1 && (
        <div className="eclipse-year-picker__results">
          <p className="eclipse-year-picker__results-hint">Plusieurs éclipses trouvées cette année-là :</p>
          <div className="eclipse-year-picker__candidates">
            {candidates.map((candidate, index) => (
              <button
                key={index}
                type="button"
                className="eclipse-year-picker__card"
                onClick={() => navigate(`/${kind}/${isoToUrlDate(candidate.calendarDate)}`)}
              >
                <div className="eclipse-year-picker__card-image">
                  {candidate.link?.image ? (
                    <img src={candidate.link.image} alt="" loading="lazy" />
                  ) : (
                    <span className="eclipse-year-picker__card-placeholder" aria-hidden>
                      {kind === 'solar' ? '☀️' : '🌕'}
                    </span>
                  )}
                </div>
                <div className="eclipse-year-picker__card-body">
                  <span className="eclipse-year-picker__card-date">
                    {dayjs(candidate.calendarDate).format('DD MMMM YYYY')}
                  </span>
                  <span className="eclipse-year-picker__card-type">
                    {typeLabels[candidate.type] ?? candidate.type}
                  </span>
                  <div className="eclipse-year-picker__card-stats">
                    <span>
                      Magnitude <strong>{candidate.magnitude}</strong>
                    </span>
                    {candidate.duration?.penumbral && (
                      <span>
                        Durée <strong>{formatDuration(candidate.duration.penumbral)}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
