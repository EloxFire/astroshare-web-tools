# Éclipses — Circonstances locales

Application web permettant de consulter les **circonstances locales des éclipses solaires et
lunaires** : recherche par année, carte interactive des zones de visibilité, circonstances
détaillées pour n'importe quel lieu du globe, diagrammes de trajectoire, et export PDF.

Toutes les données astronomiques (dates de contact, magnitude, obscuration, tracés de
visibilité...) proviennent de l'[API Astroshare](https://astroshare.fr), elle-même basée sur les
éphémérides de l'[IMCCE](https://www.imcce.fr) (Institut de mécanique céleste et de calcul des
éphémérides, Observatoire de Paris — PSL / CNRS).

## Fonctionnalités

- **Recherche par année** (`/solar`, `/lunar`) : liste des éclipses d'une année donnée sous forme
  de cartes (aperçu du globe, type, magnitude, durée).
- **Carte interactive** (Leaflet) : tracé des lignes de visibilité (limites nord/sud, courbes de
  lever/coucher, maximum), obscuration par ville, sélection d'un point par clic ou recherche de
  ville.
- **Circonstances locales** : horaires (heure locale ou UTC) des phases de contact (P1, O1, maximum,
  O4, P4 pour le solaire ; P1 à P2 pour le lunaire), durée, magnitude, obscuration, angles de
  position/zénith/hauteur du Soleil.
- **Diagrammes schématiques** de la trajectoire de la Lune devant le Soleil, ou dans l'ombre de la
  Terre.
- **Export PDF** de la carte et des circonstances locales.
- **Avertissement de sécurité** rappelant les règles d'observation du Soleil (lunettes certifiées
  ISO 12312-2) sur les pages dédiées à l'éclipse solaire.

## Stack technique

- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org) + [Vite](https://vite.dev)
- [React Router](https://reactrouter.com) pour la navigation
- [React Leaflet](https://react-leaflet.js.org) pour la cartographie (fond de carte CARTO Dark)
- [dayjs](https://day.js.org) pour le formatage des dates
- [jsPDF](https://github.com/parallax/jsPDF) + [html2canvas-pro](https://github.com/niklasvh/html2canvas) pour l'export PDF
- [lucide-react](https://lucide.dev) pour les icônes
- [oxlint](https://oxc.rs) pour le linting

## Démarrage

```bash
npm install
cp .env.example .env   # renseigner VITE_ASTROSHARE_API_URL
npm run dev
```

### Scripts disponibles

| Commande          | Description                                    |
| ----------------- | ----------------------------------------------- |
| `npm run dev`     | Serveur de développement Vite                   |
| `npm run build`   | Vérification des types (`tsc -b`) puis build     |
| `npm run lint`    | Linting avec oxlint                              |
| `npm run preview` | Prévisualisation du build de production          |

### Variables d'environnement

| Variable                     | Description                        |
| ----------------------------- | ----------------------------------- |
| `VITE_ASTROSHARE_API_URL`     | URL de base de l'API Astroshare     |

## Structure du projet

```
src/
├── api/            # Clients HTTP (Astroshare : éclipses, géocodage)
├── components/      # Composants réutilisables (carte, diagrammes, export PDF...)
├── data/            # Données statiques (liste de villes)
├── helpers/          # Fonctions utilitaires (dates, conversions, positions célestes)
├── screens/          # Pages (accueil, recherche par année, détails d'éclipse)
└── types/            # Types TypeScript des réponses de l'API
```

## Routes

| Route            | Description                                  |
| ------------------ | --------------------------------------------- |
| `/`                 | Accueil                                       |
| `/solar`            | Recherche d'une éclipse solaire par année     |
| `/solar/:date`      | Circonstances d'une éclipse solaire (JJ-MM-AAAA) |
| `/lunar`            | Recherche d'une éclipse lunaire par année     |
| `/lunar/:date`      | Circonstances d'une éclipse lunaire (JJ-MM-AAAA) |

## Avertissement

Les données affichées sont fournies à titre indicatif et peuvent différer légèrement des mesures
locales. L'observation directe du Soleil, même partiellement éclipsé, nécessite impérativement une
protection oculaire certifiée conforme à la norme ISO 12312-2.
