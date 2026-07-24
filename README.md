# README
---
application movie / serie tracker avec des pages en arborescence pour les infos de dbistribution / films et séries connexes
multi utilisateur
app crossplatform

Lire le contenu du dossier ../docs pour comprendre le dépôt

## Stack 
---

| Couche | Techno | Gratuit ? | Pourquoi |
|---|---|---|---|
| **Frontend** | Next.js + React + TypeScript | ✅ Gratuit | Rendu soigné pour dataviz/tableaux/filtres complexes, SSR/SSG natif |
| **UI/Styling** | Tailwind CSS | ✅ Gratuit | Standard et rapide |
| **Dataviz** | Recharts ou Chart.js | ✅ Gratuit | Librairies matures, intégration React simple |
| **Backend API** | NestJS + TypeScript | ✅ Gratuit | Structure en couches (modules/DTO/injection de dépendances), Swagger/OpenAPI natif pour doc API |
| **Base de données** | PostgreSQL (managé via Supabase) | ✅ Gratuit (free tier) | 500 Mo DB / 1 Go stockage |
| **Auth** | Supabase Auth (JWT), consommé par NestJS | ✅ Gratuit (free tier) | 50k utilisateurs actifs/mois gratuits |
| **Cache TMDB** | Redis (Upstash) | ✅ Gratuit (free tier) | 10k commandes/jour gratuites |
| **Source de données films/séries** | API TMDB | ✅ Gratuit | Clé gratuite pour non commercial, rate limit ok |
| **CI/CD** | GitHub Actions | ✅ Gratuit | 2000 min/mois gratuites |
| **Hébergement frontend** | Vercel | ✅ Gratuit (hobby tier) | Fait par l'éditeur de Next.js, déploiement automatique depuis GitHub, gratuit pour usage perso/non-commercial |
| **Hébergement backend** | Render ou Railway (Docker) | ⚠️ Gratuit avec limite | Free tier disponible mais cold start après inactivité (~30-50s de réveil) — acceptable pour une démo portfolio, pas pour de la prod réelle |

## Fonctionnalités
---
- profil / connexion

- recherche film / serie
    affiche / 
    titre en vo / vf
    note imdb
- page film
    vue datée
    note imdb / perso
    com
    synopsys
    affiche
    genre
    pays
    date de sortie
    distribution
    films connexes
- page serie
    note imdb / perso
    com
    synopsys
    affiche
    genre
    pays
    date de sortie
    distribution
    séries connexes
    saisons / episodes avec
        numéro et saison
        titre
        vue datée
        synopsys
        date de sortie
    
- page real ou acteur avec filmographie
    pays
    age
    genre de la personne
    genre des films
    films
        date de sortie
        personnage si acteur
    réals / acteurs connexes via algo ?

- listes film / série
    - à voir
    - personnalisées
    - recommandations auto via algo grâce à un scrap imdb ou tmdb ou autre ?

- recommandations automatiques
    - titres similaires (algorithme Jaccard pondéré : genres 0.6, acteurs 0.3, réalisateurs 0.1)
    - personnes similaires (collaborations + bonus genre)
    - calcul batch mensuel via BullMQ (queue `recommendations`)
    - endpoints admin : POST /admin/compute-recommendations, GET /admin/compute-recommendations/:jobId/status, GET /admin/recommendations/stats

- notifications
    - génération automatique pour les nouveaux épisodes des séries suivies
    - types : `new_episode`, `season_premiere`, `series_return`
    - génération dans le worker via `dailySyncNewEpisodes` (cron quotidien)
    - API : GET /notifications, PATCH /notifications/:id/read, PATCH /notifications/read-all, GET /notifications/unread-count

- calendrier de sortie pour série
    - tvtime like, par série > nombre d'épisodes non vus

- dataviz
    - temps d'écran 
        par période semaine / mois / année
        par genre
        par animation / live action
        par pays de production
        par note imdb / perso
    - nombre de films / episodes 
        par période semaine / mois / année
        par genre
        par animation / live action
        par pays de production
        par note imdb / perso

## Backend
---
sources de données
    infos films / séries / acteurs 
        tmdb
        scraper imdb ? 
    listes de films / séries ? 
        scrap senscritique / letterboxed