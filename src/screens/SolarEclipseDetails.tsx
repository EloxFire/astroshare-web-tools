import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Info, Loader2, Search } from 'lucide-react';
import type L from 'leaflet';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { astroshareApi } from '../api/astroshareApi';
import { getLocationName } from '../api/getLocationFromCoords';
import { getCityCoords } from '../api/getCityCoords';
import type { SolarEclipse } from '../types/SolarEclipse';
import { solarEclipseTypes } from '../constants';
import { convertDDtoDMS } from '../helpers/convertDDtoDMS';
import { urlDateToIso, yearFromUrlDate } from '../helpers/dateFormat';
import EclipseMap from '../components/EclipseMap';
import LocalCircumstances from '../components/LocalCircumstances';
import MoonPathDiagram from '../components/MoonPathDiagram';
import TimeModeToggle from '../components/TimeModeToggle';
import ExportPdfControl, { type CircumstancesPayload } from '../components/ExportPdfControl';
import SimpleButton from '../components/SimpleButton';
import InputWithIcon from '../components/InputWithIcon';
import VisibilityLegend from '../components/VisibilityLegend';
import './EclipseDetails.css';

dayjs.locale('fr');

type ActivePanel = 'search' | 'export' | 'legend' | null;

export default function SolarEclipseDetails() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);

  const [eclipse, setEclipse] = useState<SolarEclipse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedLocationName, setSelectedLocationName] = useState('');
  const [flyToPosition, setFlyToPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [localCircumstances, setLocalCircumstances] = useState<SolarEclipse | null>(null);
  const [eclipseNotVisible, setEclipseNotVisible] = useState(false);
  const [loadingCircumstances, setLoadingCircumstances] = useState(false);

  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [searchString, setSearchString] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  const [useLocalTime, setUseLocalTime] = useState(true);
  const [expandedVisibility, setExpandedVisibility] = useState(false);
  const [obscurationLoading, setObscurationLoading] = useState(false);

  useEffect(() => {
    const isoDate = date ? urlDateToIso(date) : null;
    const year = date ? yearFromUrlDate(date) : null;

    if (!isoDate || !year) {
      setLoadError('Adresse invalide (format attendu : JJ-MM-AAAA)');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    setEclipse(null);
    setLocalCircumstances(null);
    setSelectedLocation(null);
    setEclipseNotVisible(false);

    (async () => {
      try {
        const response = await astroshareApi.get('/eclipses/solar', { params: { year } });
        const data: SolarEclipse[] = response.data;
        const match = data?.find((item) => item.calendarDate === isoDate);
        if (!match) {
          setLoadError("Aucune éclipse solaire trouvée à cette date");
          return;
        }
        setEclipse(match);
      } catch {
        setLoadError('Erreur lors de la récupération des données');
      } finally {
        setLoading(false);
      }
    })();
  }, [date]);

  const handleMapClick = async (lat: number, lng: number) => {
    if (!eclipse) return;
    setLoadingCircumstances(true);
    try {
      const locationName = await getLocationName({ lat, lon: lng });
      setSelectedLocation({ lat, lng });
      setSelectedLocationName(locationName.local_names?.fr ?? locationName.name ?? '');

      const response = await astroshareApi.get('/eclipses/solar', {
        params: { year: eclipse.calendarDate, observer: `${lat},${lng}` },
      });
      const data = response.data[0];
      if (!data) {
        setLocalCircumstances(null);
        setEclipseNotVisible(true);
      } else {
        setLocalCircumstances(data);
        setEclipseNotVisible(false);
      }
    } catch {
      console.log('Error while fetching solar eclipse circumstances');
    } finally {
      setLoadingCircumstances(false);
    }
  };

  const handleCitySearch = async () => {
    if (!searchString.trim()) return;
    setSearchLoading(true);
    try {
      const results = await getCityCoords(searchString);
      if (!results?.length) return;
      const { lat, lon } = results[0];
      setFlyToPosition({ lat, lng: lon });
      await handleMapClick(lat, lon);
      setActivePanel(null);
      setSearchString('');
    } finally {
      setSearchLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="solar-eclipse-details__intro">
        <Loader2 size={28} className="solar-eclipse-details__spinner" color="#FFFFFF" />
      </div>
    );
  }

  if (loadError || !eclipse) {
    return (
      <div className="solar-eclipse-details__intro">
        <h1>Éclipse introuvable</h1>
        <p>{loadError}</p>
        <SimpleButton
          text="Retour à la recherche"
          onPress={() => navigate('/solar')}
          backgroundColor="#F4C23840"
          textColor="#F4C238"
        />
      </div>
    );
  }

  const hasCircumstances = !!selectedLocation && !!localCircumstances;
  const circumstancesPayload: CircumstancesPayload | null = hasCircumstances
    ? {
        kind: 'solar',
        params: {
          eclipse,
          data: localCircumstances,
          locationName: selectedLocationName,
          dms: convertDDtoDMS(selectedLocation.lat, selectedLocation.lng),
          useLocalTime,
        },
      }
    : null;

  return (
    <div className="solar-eclipse-details">
      <EclipseMap
        mapRef={mapRef}
        eclipse={eclipse}
        selectedLocation={selectedLocation}
        selectedLocationName={selectedLocationName}
        initialCenter={{ lat: 20, lng: 0 }}
        flyToPosition={flyToPosition}
        onMapClick={handleMapClick}
        expandedVisibility={expandedVisibility}
        onObscurationLoadingChange={setObscurationLoading}
      />

      <div className="solar-eclipse-details__back">
        <SimpleButton
          icon={<ArrowLeft size={16} color="#FFFFFF" />}
          text="Nouvelle recherche"
          onPress={() => navigate('/solar')}
          backgroundColor="#000000"
          textColor="#FFFFFF"
          active
          activeBorderColor="#FFFFFF40"
        />
      </div>

      <div className="solar-eclipse-details__visibility-toggle">
        <SimpleButton
          icon={
            obscurationLoading ? (
              <Loader2
                size={16}
                className="simple-button__spinner"
                color={expandedVisibility ? '#000000' : '#FFFFFF'}
              />
            ) : (
              <Eye size={16} color={expandedVisibility ? '#000000' : '#FFFFFF'} />
            )
          }
          text="Visibilité dans cette zone"
          onPress={() => setExpandedVisibility(!expandedVisibility)}
          backgroundColor={expandedVisibility ? '#F4C238' : '#000000'}
          textColor={expandedVisibility ? '#000000' : '#FFFFFF'}
          active
          activeBorderColor="#FFFFFF40"
        />
      </div>

      <div className="solar-eclipse-details__legend-toggle">
        <SimpleButton
          icon={<Info size={18} color={activePanel === 'legend' ? '#000000' : '#FFFFFF'} />}
          onPress={() => setActivePanel(activePanel === 'legend' ? null : 'legend')}
          backgroundColor={activePanel === 'legend' ? '#F4C238' : '#000000'}
          active
          activeBorderColor={activePanel === 'legend' ? '#FFFFFF' : '#FFFFFF40'}
        />
      </div>

      <div className="solar-eclipse-details__search-toggle">
        <SimpleButton
          icon={<Search size={18} color="#FFFFFF" />}
          onPress={() => {
            setActivePanel(activePanel === 'search' ? null : 'search');
            setSearchString('');
          }}
          backgroundColor="#000000"
          active
          activeBorderColor={activePanel === 'search' ? '#FFFFFF' : '#FFFFFF40'}
        />
      </div>

      {activePanel === 'search' && (
        <div className="solar-eclipse-details__search-input">
          <InputWithIcon
            placeholder="Rechercher une ville..."
            value={searchString}
            changeEvent={setSearchString}
            search={handleCitySearch}
            loading={searchLoading}
          />
        </div>
      )}

      {activePanel === 'legend' && (
        <div className="solar-eclipse-details__legend-panel">
          <VisibilityLegend kind="solar" />
        </div>
      )}

      <ExportPdfControl
        mapRef={mapRef}
        circumstances={circumstancesPayload}
        fileName={`eclipse-solaire-${eclipse.calendarDate}`}
        panelVisible={activePanel === 'export'}
        onTogglePanel={() => setActivePanel(activePanel === 'export' ? null : 'export')}
      />

      <div className="solar-eclipse-details__overlay">
        <h2 className="solar-eclipse-details__title">{dayjs(eclipse.calendarDate).format('dddd DD MMMM YYYY')}</h2>
        <p className="solar-eclipse-details__subtitle">{solarEclipseTypes[eclipse.type]}</p>
        <TimeModeToggle useLocalTime={useLocalTime} onChange={setUseLocalTime} />

        {!selectedLocation && !loadingCircumstances && (
          <p className="solar-eclipse-details__hint">Cliquez sur la carte pour obtenir les circonstances locales</p>
        )}
        {eclipseNotVisible && !loadingCircumstances && (
          <p className="solar-eclipse-details__hint">L'éclipse n'est pas visible à cet endroit</p>
        )}
        {loadingCircumstances && (
          <div className="solar-eclipse-details__loading-inline">
            <Loader2 size={20} className="solar-eclipse-details__spinner" color="#FFFFFF" />
          </div>
        )}
        {hasCircumstances && (
          <>
            <LocalCircumstances
              data={localCircumstances}
              locationName={selectedLocationName}
              dms={convertDDtoDMS(selectedLocation.lat, selectedLocation.lng)}
              useLocalTime={useLocalTime}
            />
            <MoonPathDiagram data={localCircumstances} useLocalTime={useLocalTime} />
          </>
        )}
      </div>
    </div>
  );
}
