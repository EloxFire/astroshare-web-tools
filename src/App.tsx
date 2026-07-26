import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './screens/Home';
import EclipseYearPicker from './screens/EclipseYearPicker';
import SolarEclipseDetails from './screens/SolarEclipseDetails';
import LunarEclipseDetails from './screens/LunarEclipseDetails';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/solar" element={<EclipseYearPicker kind="solar" />} />
        <Route path="/solar/:date" element={<SolarEclipseDetails />} />
        <Route path="/lunar" element={<EclipseYearPicker kind="lunar" />} />
        <Route path="/lunar/:date" element={<LunarEclipseDetails />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
