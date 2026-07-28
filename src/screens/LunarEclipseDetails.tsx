import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Info, Loader2, MapPin, Mountain, Search, X } from 'lucide-react';
import type L from 'leaflet';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { astroshareApi } from '../api/astroshareApi';
import { getLocationName } from '../api/getLocationFromCoords';
import { getCityCoords } from '../api/getCityCoords';
import type { LunarEclipse } from '../types/LunarEclipse';
import type { TrackedCity } from '../types/TrackedCity';
import { lunarEclipseTypes } from '../constants';
import { convertDDtoDMS } from '../helpers/convertDDtoDMS';
import { urlDateToIso, yearFromUrlDate } from '../helpers/dateFormat';
import { equatorialToHorizontal } from '../helpers/celestialPosition';
import { useTerrainProfile } from '../helpers/useTerrainProfile';
import { isTerrainCheckAvailable } from '../helpers/horizonObstruction';
import LunarEclipseMap from '../components/LunarEclipseMap';
import HorizonProfilePanel from '../components/HorizonProfilePanel';
import ViewpointSuggestions from '../components/ViewpointSuggestions';
import LunarLocalCircumstances from '../components/LunarLocalCircumstances';
import MoonShadowDiagram from '../components/MoonShadowDiagram';
import TimeModeToggle from '../components/TimeModeToggle';
import ExportPdfControl, { type CircumstancesPayload } from '../components/ExportPdfControl';
import SimpleButton from '../components/SimpleButton';
import InputWithIcon from '../components/InputWithIcon';
import VisibilityLegend from '../components/VisibilityLegend';
import TrackedCitiesPanel from '../components/TrackedCitiesPanel';
import './EclipseDetails.css';

dayjs.locale('fr');

type ActivePanel = 'search' | 'export' | 'legend' | 'cities' | null;

export default function LunarEclipseDetails() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);

  const [eclipse, setEclipse] = useState<LunarEclipse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedLocationName, setSelectedLocationName] = useState('');
  const [flyToPosition, setFlyToPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [resolvingLocation, setResolvingLocation] = useState(false);

  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [searchString, setSearchString] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  const [useLocalTime, setUseLocalTime] = useState(true);
  const [trackedCities, setTrackedCities] = useState<TrackedCity[]>([]);
  const [overlayCollapsed, setOverlayCollapsed] = useState(false);
  // Le relief topographique est bien plus lisible pour planifier une observation que le thème
  // sombre stylisé — actif par défaut dès qu'un token Mapbox est configuré (sinon `showTopography`
  // n'a de toute façon aucun effet, LunarEclipseMap se rabat sur CARTO).
  const [showTopography, setShowTopography] = useState(isTerrainCheckAvailable());

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
    setSelectedLocation(null);

    (async () => {
      try {
        const response = await astroshareApi.get('/eclipses/lunar', { params: { year } });
        const data: LunarEclipse[] = response.data;
        const match = data?.find((item) => item.calendarDate === isoDate);
        if (!match) {
          setLoadError('Aucune éclipse lunaire trouvée à cette date');
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

  const referenceEvent = eclipse?.events.greatest ?? eclipse?.events.U2 ?? eclipse?.events.P1;
  const referenceHorizontal =
    referenceEvent && selectedLocation
      ? equatorialToHorizontal(referenceEvent.date, referenceEvent.Moon.RA, referenceEvent.Moon.DEC, selectedLocation.lat, selectedLocation.lng)
      : null;
  const {
    profile: terrainProfile,
    result: terrainResult,
    checking: checkingTerrain,
  } = useTerrainProfile(selectedLocation, referenceHorizontal?.altitude, referenceHorizontal?.azimuth);

  const selectLocation = async (lat: number, lng: number, locationName?: string) => {
    setResolvingLocation(true);
    try {
      let name: string = locationName ?? '';
      if (!name) {
        const result = await getLocationName({ lat, lon: lng });
        name = result.local_names?.fr ?? result.name ?? '';
      }
      setSelectedLocation({ lat, lng });
      setSelectedLocationName(name);
    } catch {
      console.log('Error while resolving location name');
    } finally {
      setResolvingLocation(false);
    }
  };

  const handleMapClick = (lat: number, lng: number) => selectLocation(lat, lng);

  const handleCityBadgeClick = (city: TrackedCity) => {
    setOverlayCollapsed(false);
    selectLocation(city.lat, city.lng, city.name);
  };

  const clearSelection = () => {
    setSelectedLocation(null);
    setSelectedLocationName('');
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
          onPress={() => navigate('/lunar')}
          backgroundColor="#F4C23840"
          textColor="#F4C238"
        />
      </div>
    );
  }

  const hasCircumstances = !!selectedLocation && !resolvingLocation;
  const circumstancesPayload: CircumstancesPayload | null = hasCircumstances
    ? {
        kind: 'lunar',
        params: {
          eclipse,
          locationName: selectedLocationName,
          dms: convertDDtoDMS(selectedLocation.lat, selectedLocation.lng),
          location: selectedLocation,
          useLocalTime,
        },
      }
    : null;

  return (
    <div className="solar-eclipse-details">
      <div className="solar-eclipse-details__map-area">
        <LunarEclipseMap
          mapRef={mapRef}
          eclipse={eclipse}
          selectedLocation={selectedLocation}
          selectedLocationName={selectedLocationName}
          initialCenter={{ lat: 20, lng: 0 }}
          flyToPosition={flyToPosition}
          onMapClick={handleMapClick}
          cities={trackedCities}
          onCityClick={handleCityBadgeClick}
          terrainProfile={terrainProfile}
          terrainTargetAltitude={referenceHorizontal?.altitude}
          terrainTargetAzimuth={referenceHorizontal?.azimuth}
          showTopography={showTopography}
        />

        <div className="solar-eclipse-details__back">
          <SimpleButton
            icon={<ArrowLeft size={16} color="#FFFFFF" />}
            text="Nouvelle recherche"
            onPress={() => navigate('/lunar')}
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

        {isTerrainCheckAvailable() && (
          <div className="solar-eclipse-details__topography-toggle">
            <SimpleButton
              icon={<Mountain size={18} color={showTopography ? '#000000' : '#FFFFFF'} />}
              onPress={() => setShowTopography((value) => !value)}
              backgroundColor={showTopography ? '#F4C238' : '#000000'}
              active
              activeBorderColor={showTopography ? '#FFFFFF' : '#FFFFFF40'}
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
            <VisibilityLegend kind="lunar" />
          </div>
        )}

        <ExportPdfControl
          mapRef={mapRef}
          kind="lunar"
          circumstances={circumstancesPayload}
          fileName={`eclipse-lunaire-${eclipse.calendarDate}`}
          panelVisible={activePanel === 'export'}
          onTogglePanel={() => setActivePanel(activePanel === 'export' ? null : 'export')}
          hasTrackedCities={trackedCities.some((city) => city.enabled)}
        />

        {selectedLocation && terrainProfile && referenceHorizontal?.altitude != null && referenceHorizontal?.azimuth != null && (
          <div className="solar-eclipse-details__horizon-slot--floating">
            <HorizonProfilePanel
              profile={terrainProfile}
              targetAltitudeDeg={referenceHorizontal.altitude}
              targetAzimuthDeg={referenceHorizontal.azimuth}
              originName={selectedLocationName}
              actions={
                terrainResult?.blocked ? (
                  <ViewpointSuggestions
                    origin={selectedLocation}
                    targetAltitudeDeg={referenceHorizontal.altitude}
                    targetAzimuthDeg={referenceHorizontal.azimuth}
                    onSelect={(lat, lng, name) => selectLocation(lat, lng, name)}
                  />
                ) : undefined
              }
            />
          </div>
        )}
      </div>

      <div
        className={`solar-eclipse-details__overlay${overlayCollapsed ? ' solar-eclipse-details__overlay--collapsed' : ''}${hasCircumstances ? ' solar-eclipse-details__overlay--docked' : ''}`}
      >
        <div className="solar-eclipse-details__overlay-header">
          <div className="solar-eclipse-details__overlay-heading">
            <h2 className="solar-eclipse-details__title">{dayjs(eclipse.calendarDate).format('dddd DD MMMM YYYY')}</h2>
            <p className="solar-eclipse-details__subtitle">{lunarEclipseTypes[eclipse.type] ?? eclipse.type}</p>
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
              className="solar-eclipse-details__overlay-action solar-eclipse-details__overlay-collapse"
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

          {!selectedLocation && !resolvingLocation && (
            <p className="solar-eclipse-details__hint">Cliquez sur la carte pour vérifier la visibilité locale</p>
          )}
          {resolvingLocation && (
            <div className="solar-eclipse-details__loading-inline">
              <Loader2 size={20} className="solar-eclipse-details__spinner" color="#FFFFFF" />
            </div>
          )}
          {hasCircumstances && (
            <>
              <LunarLocalCircumstances
                data={eclipse}
                locationName={selectedLocationName}
                dms={convertDDtoDMS(selectedLocation.lat, selectedLocation.lng)}
                location={selectedLocation}
                useLocalTime={useLocalTime}
                terrainResult={terrainResult}
                checkingTerrain={checkingTerrain}
              />
              {terrainProfile && referenceHorizontal?.altitude != null && referenceHorizontal?.azimuth != null && (
                <div className="solar-eclipse-details__horizon-slot--inline">
                  <HorizonProfilePanel
                    variant="inline"
                    profile={terrainProfile}
                    targetAltitudeDeg={referenceHorizontal.altitude}
                    targetAzimuthDeg={referenceHorizontal.azimuth}
                    originName={selectedLocationName}
                    actions={
                      terrainResult?.blocked ? (
                        <ViewpointSuggestions
                          layout="inline"
                          origin={selectedLocation}
                          targetAltitudeDeg={referenceHorizontal.altitude}
                          targetAzimuthDeg={referenceHorizontal.azimuth}
                          onSelect={(lat, lng, name) => selectLocation(lat, lng, name)}
                        />
                      ) : undefined
                    }
                  />
                </div>
              )}
              <MoonShadowDiagram data={eclipse} useLocalTime={useLocalTime} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
