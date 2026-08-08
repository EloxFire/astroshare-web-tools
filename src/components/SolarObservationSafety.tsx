import { useState } from 'react';
import { ChevronDown, Eye, EyeOff, Telescope, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './SolarObservationSafety.css';

interface SafetyItem {
  icon: LucideIcon;
  title: string;
  body: string;
}

const SAFETY_ITEMS: SafetyItem[] = [
  {
    icon: Eye,
    title: 'La seule protection valable',
    body: "Des lunettes certifiées ISO 12312-2:2015, marquage CE, sans rayure ni trou. En pharmacie, chez les opticiens, ou en boutique spécialisée — les stocks partent vite à l'approche d'une éclipse.",
  },
  {
    icon: EyeOff,
    title: 'Ce qui ne protège pas',
    body: 'Lunettes de soleil (même superposées), films photo, disquettes, CD, verres fumés : rien de tout ça ne filtre suffisamment.',
  },
  {
    icon: Telescope,
    title: 'Jumelles, télescope, appareil photo',
    body: "Filtre solaire devant l'objectif, jamais derrière. Ne regardez jamais à travers un instrument non filtré.",
  },
];

export default function SolarObservationSafety() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="solar-observation-safety">
      <button
        type="button"
        className="solar-observation-safety__toggle"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <TriangleAlert size={16} className="solar-observation-safety__icon" />
        <span className="solar-observation-safety__headline">
          Protégez vos yeux : même très éclipsé, le Soleil reste dangereux à regarder à l'œil nu.
        </span>
        <ChevronDown
          size={14}
          className={`solar-observation-safety__chevron${expanded ? ' solar-observation-safety__chevron--open' : ''}`}
        />
      </button>

      {expanded && (
        <div className="solar-observation-safety__body">
          <p className="solar-observation-safety__intro">
            Même masqué à 99 %, le Soleil reste des milliers de fois trop lumineux pour l'œil nu. Quelques
            secondes suffisent à provoquer des lésions graves et irréversibles, jusqu'à la perte totale de la
            vision — et aucune douleur ne prévient.
          </p>

          {SAFETY_ITEMS.map(({ icon: Icon, title, body }) => (
            <div className="solar-observation-safety__item" key={title}>
              <Icon size={14} className="solar-observation-safety__item-icon" />
              <p>
                <strong>{title}</strong> {body}
              </p>
            </div>
          ))}

          <p className="solar-observation-safety__intro">
            <strong>Pas de lunettes sous la main ?</strong> Un trou d'épingle dans un carton projette l'image
            du Soleil sur une surface derrière lui — sans jamais regarder à travers.
          </p>

          <p className="solar-observation-safety__exception">
            Seule exception : dans la bande de totalité, les lunettes se retirent uniquement pendant les
            quelques secondes de totalité complète. Partout ailleurs (éclipse partielle), elles restent sur le
            nez du début à la fin.
          </p>
        </div>
      )}
    </div>
  );
}
