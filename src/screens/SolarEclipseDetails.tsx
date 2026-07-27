import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Info, Loader2, MapPin, Search, X } from 'lucide-react';
import type L from 'leaflet';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { astroshareApi } from '../api/astroshareApi';
import { getLocationName } from '../api/getLocationFromCoords';
import { getCityCoords } from '../api/getCityCoords';
import type { SolarEclipse } from '../types/SolarEclipse';
import type { TrackedCity } from '../types/TrackedCity';
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
import TrackedCitiesPanel from '../components/TrackedCitiesPanel';
import './EclipseDetails.css';

dayjs.locale('fr');

type ActivePanel = 'search' | 'export' | 'legend' | 'cities' | null;

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
  const [trackedCities, setTrackedCities] = useState<TrackedCity[]>([]);
  const [overlayCollapsed, setOverlayCollapsed] = useState(false);

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

  const fetchCircumstancesAt = async (lat: number, lng: number, locationName?: string) => {
    if (!eclipse) return;
    setLoadingCircumstances(true);
    try {
      let name: string = locationName ?? '';
      if (!name) {
        const result = await getLocationName({ lat, lon: lng });
        name = result.local_names?.fr ?? result.name ?? '';
      }
      setSelectedLocation({ lat, lng });
      setSelectedLocationName(name);

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

  const handleMapClick = (lat: number, lng: number) => fetchCircumstancesAt(lat, lng);

  const handleCityBadgeClick = (city: TrackedCity) => {
    setOverlayCollapsed(false);
    fetchCircumstancesAt(city.lat, city.lng, city.name);
  };

  const clearSelection = () => {
    setSelectedLocation(null);
    setSelectedLocationName('');
    setLocalCircumstances(null);
    setEclipseNotVisible(false);
  };

  const addTrackedCity = (name: string, lat: number, lng: number) => {
    const id = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    setTrackedCities((prev) => (prev.some((city) => city.id === id) ? prev : [...prev, { id, name, lat, lng, enabled: true }]));
  };

  const toggleTrackedCity = (id: string) => {
    setTrackedCities((prev) => prev.map((city) => (city.id === id ? { ...city, enabled: !city.enabled } : city)));
  };

  const removeTrackedCity = (id: string) => {
    setTrackedCities((prev) => prev.filter((city) => city.id !== id));
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
        cities={trackedCities}
        onCityClick={handleCityBadgeClick}
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

      <div className="solar-eclipse-details__cities-toggle">
        <SimpleButton
          icon={<MapPin size={18} color={activePanel === 'cities' ? '#000000' : '#FFFFFF'} />}
          onPress={() => setActivePanel(activePanel === 'cities' ? null : 'cities')}
          backgroundColor={activePanel === 'cities' ? '#F4C238' : '#000000'}
          active
          activeBorderColor={activePanel === 'cities' ? '#FFFFFF' : '#FFFFFF40'}
        />
      </div>

      {activePanel === 'cities' && (
        <div className="solar-eclipse-details__cities-panel">
          <TrackedCitiesPanel
            cities={trackedCities}
            onAdd={addTrackedCity}
            onToggle={toggleTrackedCity}
            onRemove={removeTrackedCity}
          />
        </div>
      )}

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
        hasTrackedCities={trackedCities.some((city) => city.enabled)}
      />

      <div
        className={`solar-eclipse-details__overlay${overlayCollapsed ? ' solar-eclipse-details__overlay--collapsed' : ''}`}
      >
        <div className="solar-eclipse-details__overlay-header">
          <div className="solar-eclipse-details__overlay-heading">
            <h2 className="solar-eclipse-details__title">{dayjs(eclipse.calendarDate).format('dddd DD MMMM YYYY')}</h2>
            <p className="solar-eclipse-details__subtitle">{solarEclipseTypes[eclipse.type]}</p>
          </div>
          <div className="solar-eclipse-details__overlay-actions">
            {selectedLocation && (
              <button
                type="button"
                className="solar-eclipse-details__overlay-action"
                onClick={clearSelection}
                aria-label="Désélectionner le lieu"
              >
                <X size={15} />
              </button>
            )}
            <button
              type="button"
              className="solar-eclipse-details__overlay-action"
              onClick={() => setOverlayCollapsed((collapsed) => !collapsed)}
              aria-label={overlayCollapsed ? 'Agrandir le panneau' : 'Réduire le panneau'}
            >
              <ChevronDown
                size={15}
                className={
                  overlayCollapsed ? 'solar-eclipse-details__overlay-chevron--collapsed' : undefined
                }
              />
            </button>
          </div>
        </div>

        <div className="solar-eclipse-details__overlay-body">
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
    </div>
  );
}
