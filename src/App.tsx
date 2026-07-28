import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Home from './screens/Home';
import EclipseYearPicker from './screens/EclipseYearPicker';

// Chargées à la demande : ces deux écrans embarquent Leaflet/react-leaflet et toute la mécanique
// d'export PDF, de loin les plus lourds de l'app, alors qu'ils ne sont visités qu'après un premier
// choix de date sur EclipseYearPicker.
const SolarEclipseDetails = lazy(() => import('./screens/SolarEclipseDetails'));
const LunarEclipseDetails = lazy(() => import('./screens/LunarEclipseDetails'));

const RouteLoading = () => (
  <div className="app-route-loading">
    <Loader2 size={32} color="#FFFFFF" />
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/solar" element={<EclipseYearPicker kind="solar" />} />
          <Route path="/solar/:date" element={<SolarEclipseDetails />} />
          <Route path="/lunar" element={<EclipseYearPicker kind="lunar" />} />
          <Route path="/lunar/:date" element={<LunarEclipseDetails />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
