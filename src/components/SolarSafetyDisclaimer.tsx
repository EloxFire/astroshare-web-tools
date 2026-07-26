import { TriangleAlert } from 'lucide-react';
import './SolarSafetyDisclaimer.css';

const RULES = [
  'Ne regardez jamais le Soleil à l’œil nu, même partiellement éclipsé.',
  'Lunettes d’éclipse certifiées ISO 12312-2 uniquement — sans rayure, sans trou.',
  'Les lunettes de soleil classiques, même très foncées, ne protègent pas vos yeux.',
  'Jumelles, lunette, télescope : un filtre solaire certifié doit être fixé devant l’instrument.',
  'Ne laissez jamais un enfant observer le Soleil sans surveillance.',
];

export default function SolarSafetyDisclaimer() {
  return (
    <div className="solar-safety-disclaimer" role="alert">
      <div className="solar-safety-disclaimer__header">
        <TriangleAlert size={22} className="solar-safety-disclaimer__icon" aria-hidden />
        <strong>Protégez vos yeux</strong>
      </div>
      <ul className="solar-safety-disclaimer__list">
        {RULES.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </div>
  );
}
