# eMDB - Documentation

*Centre de documentation technique et fonctionnelle*

---

## 📚 Table des Matières

### Documentation Synthétique
- [📋 Architecture & Modules Overview](./ARCHITECTURE_OVERVIEW.md) - *Pour Chefs de Projet Data / Product Owners*
  - Vue d'ensemble de l'architecture
  - Organisation du dépôt
  - Description des modules fonctionnels
  - Flux de données et dépendances
  - Points clés pour la data
- [📁 Technical Details (Annexe)](./TECHNICAL_DETAILS.md) - *Fichiers sources + Tests*
  - Liste exhaustive des fichiers par module
  - Détails des tests (unitaires, intégration, E2E)
  - Validation et qualité

### Documentation Technique par Phase

#### Phase 0 - Socle Technique
- [🛠️ Phase 0: Setup Initial](./phase_0_setup.md) - Configuration du projet

#### Phase 3 - API Cœur (CRUD)
- [🎬 Phase 3.5: Seasons & Episodes Context](./phase-3.5-seasons-episodes-context.md)
- [🎭 Phase 3.6: Credits Context](./phase-3.6-credits-context.md)

#### Phase 4 - Fonctionnalités Utilisateur
- [👀 Phase 4.1: Watches Context](./phase-4.1-watches-context.md) - Visionnage, suivi séries, calendrier
- [⭐ Phase 4.2: Ratings Context](./phase-4.2-ratings-context.md) - Notation utilisateur
- [📋 Phase 4.3: Lists Context](./phase-4.3-lists-context.md) - Listes personnalisées et partage
- [🔔 Phase 4.4: Follows Context](./phase-4.4-follows-context.md) - Suivi de séries (intégré dans Watches)

#### Phase 5 - Recommandations
- [🤖 Phase 5.1: Recommender Context](./phase-5.1-recommender-context.md) - Algorithme de similarité
- [🎛️ Phase 5.2: Admin Recommender Context](./phase-5.2-admin-recommender-context.md) - Administration et worker
- [🔄 Phase 5.3: Person Fallback Context](./phase-5.3-person-fallback-context.md) - Fallback TMDB

#### Phase 6 - Dataviz
- [📊 Phase 6.1: Dataviz API Context](./phase-6.1-dataviz-api-context.md) - Endpoints dataviz
- [🔄 Phase 6.2: Admin Refresh Context](./phase-6.2-admin-refresh-context.md) - Refresh vues matérialisées

---

## 🎯 Documentation par Public Cible

### Pour les Chefs de Projet Data / Product Owners
**Document principal** : [Architecture & Modules Overview](./ARCHITECTURE_OVERVIEW.md)

Ce document répond aux questions :
- Quel module fait quoi ?
- Comment les modules interagissent-ils ?
- Comment sont organisés les modules dans le dépôt ?
- Quelles sont les dépendances entre modules ?
- Quels sont les points d'attention pour la data ?

### Pour les Développeurs Backend
Consulter :
1. [Architecture Overview](./ARCHITECTURE_OVERVIEW.md) - Vue globale
2. Documentation par phase (voir ci-dessus)
3. [Roadmap Backend](../emdb_roadmap_backend.md) - Détails techniques complets

### Pour les Développeurs Frontend
Consulter :
- [Roadmap Frontend](../emdb_roadmap_frontend.md)

---

## 🔗 Liens Utiles

- **Roadmap Backend** : [emdb_roadmap_backend.md](../emdb_roadmap_backend.md)
- **Roadmap Frontend** : [emdb_roadmap_frontend.md](../emdb_roadmap_frontend.md)
- **Schéma Base de Données** : [scripts/db_init_v3.sql](../scripts/db_init_v3.sql)
- **Configuration** : [.env.example](../.env.example)
- **README Principal** : [README.md](../README.md)

---

## 📊 Aide au Choix

| Besoin | Document Recommandé |
|--------|----------------------|
| Comprendre l'architecture globale | [Architecture Overview](./ARCHITECTURE_OVERVIEW.md) |
| Savoir quel module fait quoi | [Architecture Overview](./ARCHITECTURE_OVERVIEW.md) |
| Voir les dépendances entre modules | [Architecture Overview](./ARCHITECTURE_OVERVIEW.md) |
| Comprendre les flux de données | [Architecture Overview](./ARCHITECTURE_OVERVIEW.md) |
| Voir la structure du dépôt | [Architecture Overview](./ARCHITECTURE_OVERVIEW.md) |
| Configurer l'environnement | [Phase 0 Setup](./phase_0_setup.md) |
| Comprendre un module spécifique | Documentation de phase correspondante |
| Voir les détails techniques | Roadmap backend/frontend |
| Comprendre la base de données | [Schéma SQL](../scripts/db_init_v3.sql) |

---

## 💡 Conseils

- **Nouveau sur le projet** ? Commencez par [Architecture Overview](./ARCHITECTURE_OVERVIEW.md)
- **Recherche d'une fonctionnalité** ? Consultez la section correspondante dans le document d'architecture
- **Développement d'un module** ? Lisez la documentation de phase + le code existant
- **Problème technique** ? Vérifiez d'abord les dépendances dans le tableau du document d'architecture

---

*Dernière mise à jour : 24 juillet 2026*
