import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { ArrowLeft, Search } from 'lucide-react';
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

// const heroKickers: Record<'solar' | 'lunar', string> = {
//   solar: '☀️ Éclipse solaire',
//   lunar: '🌕 Éclipse lunaire',
// };

const heroSubtitles: Record<'solar' | 'lunar', string> = {
  solar: "Entrez une année pour retrouver l'éclipse solaire correspondante et consulter ses circonstances locales.",
  lunar: "Entrez une année pour retrouver l'éclipse lunaire correspondante et consulter ses circonstances locales.",
};

type LegendIcon = 'partial' | 'annular' | 'total' | 'hybrid' | 'penumbral';

const legendContent: Record<'solar' | 'lunar', { title: string; description: string; icon: LegendIcon }[]> = {
  solar: [
    {
      title: 'Éclipse partielle',
      icon: 'partial',
      description: "La Lune ne masque qu'une partie du disque solaire.",
    },
    {
      title: 'Éclipse annulaire',
      icon: 'annular',
      description: 'La Lune, trop éloignée pour couvrir tout le Soleil, laisse un anneau de lumière visible.',
    },
    {
      title: 'Éclipse totale',
      icon: 'total',
      description: "Le disque solaire est entièrement masqué : le jour s'assombrit brièvement.",
    }
  ],
  lunar: [
    {
      title: 'Éclipse pénombrale',
      icon: 'penumbral',
      description: "La Lune traverse la pénombre terrestre : l'assombrissement reste discret.",
    },
    {
      title: 'Éclipse partielle',
      icon: 'partial',
      description: "Une partie de la Lune entre dans l'ombre de la Terre.",
    },
    {
      title: 'Éclipse totale',
      icon: 'total',
      description: 'La Lune est entièrement immergée dans l’ombre terrestre et prend une teinte rougeâtre.',
    },
  ],
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
      <div className="eclipse-year-picker__hero" style={{ backgroundImage: `url('/${kind}-eclipse.jpg')` }}>
        <div className="eclipse-year-picker__hero-screen" />
        <Link to="/" className="eclipse-year-picker__back">
          <ArrowLeft size={15} /> Retour
        </Link>
        <div className="eclipse-year-picker__hero-content">
          {/* <span className="eclipse-year-picker__kicker">{heroKickers[kind]}</span> */}
          <h1>{titles[kind]}</h1>
          <p>{heroSubtitles[kind]}</p>
        </div>
      </div>

      <div className="eclipse-year-picker__body">
        {kind === 'solar' && <SolarSafetyDisclaimer />}

        <div className="eclipse-year-picker__card">
          <p className="eclipse-year-picker__card-label">Rechercher par année</p>
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
              icon={!loading ? <Search size={16} /> : undefined}
              loading={loading}
              onPress={search}
              backgroundColor="#F4C23840"
              textColor="#F4C238"
            />
          </div>
          {error && <p className="eclipse-year-picker__error">{error}</p>}
        </div>

        {candidates.length > 1 && (
          <div className="eclipse-year-picker__results">
            <p className="eclipse-year-picker__results-hint">Plusieurs éclipses trouvées cette année-là :</p>
            <div className="eclipse-year-picker__candidates">
              {candidates.map((candidate, index) => (
                <button
                  key={index}
                  type="button"
                  className="eclipse-year-picker__card-result"
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

        <div className="eclipse-year-picker__legend">
          <h2>Les types {kind === 'solar' ? "d'éclipse solaire" : "d'éclipse lunaire"}</h2>
          <div className="eclipse-year-picker__legend-grid">
            {legendContent[kind].map((item) => (
              <div className="eclipse-year-picker__legend-card" key={item.title}>
                <span className={`eclipse-type-icon eclipse-type-icon--${item.icon}`} aria-hidden />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
