import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import EclipseCountdownBanner from '../components/EclipseCountdownBanner';
import './Home.css';

const CURRENT_YEAR = new Date().getFullYear();

export default function Home() {
  const [downloadOpen, setDownloadOpen] = useState(false);

  return (
    <div className="home">
      <header className="home__navbar">
        <img src="/LOGO_ASTROSHARE_WHITE.png" alt="Astroshare" className="home__navbar-logo" />

        <nav className="home__navbar-links">
          <a href="https://astroshare.fr" target="_blank" rel="noreferrer noopener" className="home__navbar-link">
            Retour sur astroshare.fr
          </a>

          <div className="home__navbar-download">
            <button
              type="button"
              className="home__navbar-cta"
              onClick={() => setDownloadOpen((open) => !open)}
              aria-expanded={downloadOpen}
            >
              Télécharger l'app
              <ChevronDown size={15} className={downloadOpen ? 'home__navbar-cta-chevron--open' : ''} />
            </button>

            {downloadOpen && (
              <div className="home__navbar-download-panel">
                <a
                  href="https://apps.apple.com/fr/app/astroshare/id6737229342"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="home__navbar-app-button home__navbar-app-button--light"
                >
                  <img src="/app-store-black.png" alt="" className="home__navbar-app-icon" />
                  <span>
                    Télécharger dans
                    <br />
                    l'App Store
                  </span>
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=fr.eavagliano.astroshare"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="home__navbar-app-button home__navbar-app-button--dark"
                >
                  <img src="/play-store-black.png" alt="" className="home__navbar-app-icon home__navbar-app-icon--invert" />
                  <span>
                    Disponible sur
                    <br />
                    Google Play
                  </span>
                </a>
              </div>
            )}
          </div>
        </nav>
      </header>

      <div className="home__content">
        <h1 className="home__title">Observez les prochaines éclipses facilement !</h1>
        <p className="home__subtitle">Choisissez un type d'éclipse pour commencer.</p>

        <EclipseCountdownBanner />

        <div className="home__choices">
          <Link to="/solar" className="home__choice" style={{ backgroundImage: "url('/solar-eclipse.jpg')" }}>
            <div className="home__choice-screen" />
            <div className="home__choice-body">
              <span className="home__choice-title">Éclipse solaire</span>
              <span className="home__choice-description">
                Circonstances locales par lieu, obscuration par ville, trajectoire de la Lune devant le Soleil.
              </span>
            </div>
          </Link>

          <Link to="/lunar" className="home__choice" style={{ backgroundImage: "url('/lunar-eclipse.jpg')" }}>
            <div className="home__choice-screen" />
            <div className="home__choice-body">
              <span className="home__choice-title">Éclipse lunaire</span>
              <span className="home__choice-description">
                Visibilité locale (altitude de la Lune), trajectoire dans l'ombre de la Terre.
              </span>
            </div>
          </Link>
        </div>
      </div>

      <footer className="home__footer">
        <div className="home__footer-columns">
          <div className="home__footer-col home__footer-col--brand">
            <img src="/LOGO_ASTROSHARE_WHITE.png" alt="Astroshare" className="home__footer-logo" />
            <p>
              Calculs et données astronomiques fournis par l'API{' '}
              <a href="https://astroshare.fr" target="_blank" rel="noreferrer noopener">
                Astroshare
              </a>
              , elle-même basée sur les éphémérides de l'
              <abbr title="Institut de mécanique céleste et de calcul des éphémérides">IMCCE</abbr>
              , Observatoire de Paris — PSL / CNRS. Circonstances fournies à titre indicatif.
            </p>

            <p className="home__copyright">© {CURRENT_YEAR} Astroshare. Tous droits réservés.</p>
          </div>

          <div className="home__footer-col">
            <h3>Liens</h3>
            <Link to="/" className="home__footer-link">
              Accueil
            </Link>
            <a href="https://astroshare.fr" target="_blank" rel="noreferrer noopener" className="home__footer-link">
              astroshare.fr
            </a>
            <a href="https://www.imcce.fr" target="_blank" rel="noreferrer noopener" className="home__footer-link">
              IMCCE
            </a>
          </div>

          <div className="home__footer-col">
            <h3>Application mobile</h3>
            <a
              href="https://apps.apple.com/fr/app/astroshare/id6737229342"
              target="_blank"
              rel="noreferrer noopener"
              className="home__footer-badge-link"
            >
              <img src="/app-store-badge.png" alt="Télécharger dans l'App Store" className="home__footer-badge" />
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=fr.eavagliano.astroshare"
              target="_blank"
              rel="noreferrer noopener"
              className="home__footer-badge-link"
            >
              <img src="/google-play-badge.png" alt="Disponible sur Google Play" className="home__footer-badge" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
