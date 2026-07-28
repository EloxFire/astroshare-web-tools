import { Link } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import './DataAccuracy.css';

export default function DataAccuracy() {
  return (
    <div className="data-accuracy">
      <header className="data-accuracy__header">
        <Link to="/" className="data-accuracy__back">
          <ArrowLeft size={16} />
          Retour à l'accueil
        </Link>
      </header>

      <div className="data-accuracy__content">
        <h1 className="data-accuracy__title">Sources des données &amp; précision des calculs</h1>

        <section className="data-accuracy__section">
          <h2>Sources des données</h2>
          <p>
            Les circonstances des éclipses (horaires de contact, magnitude, obscuration, tracés de visibilité) sont
            calculées par l'<a href="https://astroshare.fr" target="_blank" rel="noreferrer noopener">API Astroshare</a>,
            elle-même basée sur les éphémérides de l'
            <abbr title="Institut de mécanique céleste et de calcul des éphémérides">IMCCE</abbr> (
            <a href="https://www.imcce.fr" target="_blank" rel="noreferrer noopener">
              Institut de mécanique céleste et de calcul des éphémérides
            </a>
            , Observatoire de Paris — PSL / CNRS) — une référence scientifique publique pour ce type de calcul.
          </p>
          <p>
            Les fonds de carte proviennent d'<a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer noopener">OpenStreetMap</a>{' '}
            (via CARTO) et de <a href="https://www.mapbox.com" target="_blank" rel="noreferrer noopener">Mapbox</a> pour
            le relief. La vérification du relief environnant utilise les tuiles Terrain-RGB de Mapbox, qui encodent une
            altitude du sol à une résolution d'environ 30 mètres.
          </p>
        </section>

        <section className="data-accuracy__section">
          <h2>Fiabilité des calculs astronomiques</h2>
          <p>
            Les horaires de contact, la magnitude et l'obscuration reposent sur des éphémérides de très haute
            précision : à l'échelle de la mécanique céleste, ces éléments sont connus avec une exactitude de l'ordre de
            la seconde. Ce n'est donc pas la source d'incertitude principale pour une observation sur le terrain — ce
            sont les facteurs locaux ci-dessous qui comptent le plus.
          </p>
        </section>

        <section className="data-accuracy__section">
          <div className="data-accuracy__callout">
            <div className="data-accuracy__callout-header">
              <Info size={18} className="data-accuracy__callout-icon" />
              <strong>Facteurs pouvant affecter l'observation réelle</strong>
            </div>
            <ul className="data-accuracy__callout-list">
              <li>
                <strong>Météo le jour J</strong> — nuages, brume ou pollution atmosphérique peuvent masquer
                l'événement quels que soient les horaires calculés. Aucun outil ne peut prévoir la météo plusieurs mois
                à l'avance : consultez les prévisions à l'approche de la date.
              </li>
              <li>
                <strong>Précision du point sélectionné</strong> — un clic sur la carte a une précision de l'ordre de
                quelques dizaines à quelques centaines de mètres selon le niveau de zoom. Pour une éclipse totale ou
                annulaire, la limite de la bande de centralité peut se déplacer significativement sur une distance
                comparable : si vous êtes proche d'une limite, vérifiez votre position exacte et prévoyez une marge de
                sécurité en vous rapprochant du centre de la bande.
              </li>
              <li>
                <strong>Relief environnant</strong> — la vérification d'horizon ne prend en compte que le relief
                naturel (topographie) : bâtiments, arbres et autres structures ne sont pas modélisés. La résolution des
                données de terrain (~30 m) peut aussi lisser de petits reliefs locaux.
              </li>
              <li>
                <strong>Réfraction atmosphérique</strong> — l'abaissement de l'horizon par la réfraction est approximé
                par un coefficient standard ; les conditions atmosphériques réelles (pression, température) peuvent
                légèrement faire varier l'angle et l'heure exacts au lever/coucher.
              </li>
              <li>
                <strong>Suggestions de points de vue</strong> — les outils de recherche de points dégagés ou de point
                visible le plus proche testent un nombre limité de positions candidates et peuvent manquer un meilleur
                point situé entre deux candidats testés.
              </li>
            </ul>
          </div>
        </section>

        <section className="data-accuracy__section">
          <h2>En résumé</h2>
          <p>
            Ces marges d'erreur restent modestes et n'enlèvent rien à la fiabilité générale des données affichées, qui
            comptent parmi les plus solides disponibles publiquement pour ce type de calcul. Elles justifient
            simplement quelques précautions de bon sens pour une observation sur le terrain : arriver en avance,
            vérifier votre position si vous êtes proche d'une limite de visibilité, et garder un œil sur la météo
            locale à l'approche de la date.
          </p>
        </section>
      </div>
    </div>
  );
}
