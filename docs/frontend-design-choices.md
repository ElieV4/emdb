# Choix de Design — eMDB Frontend

> **Objectif** : Identifier les points de design qui doivent être tranchés avant/pendant le développement frontend. Pour chaque point, une recommandation basée sur Trakt.tv (adaptée avec une primaire rouge).

---

## 1. Palette de couleurs

### Question
Quelle palette exacte utiliser pour le thème sombre et light, au-delà de la couleur primaire rouge ?

### État actuel
La roadmap mentionne "Couleurs personnalisées (primary, secondary, accent)" mais sans définition précise.

### Recommandation (basée sur Trakt.tv,Adaptée)
- **Primary** : Rouge eMDB `#e50914` (Trakt.tv utilise `#ed1f24` ou proche violet → on garde le rouge)
- **Secondary** : Gris bleuté `#2a2a2a` (dark) / `#f5f5f5` (light)
- **Accent** : Jaune/or pour les ratings `#ffc107` (étoiles Dorées)
- **Success** : Vert `#4caf50` (watched, validé)
- **Warning** : Orange `#ff9800` (en cours, notifications)
- **Danger** : Rouge foncé `#d32f2f` (suppression, error)
- **Text primary** : Blanc `#ffffff` (dark) / Noir `#1a1a1a` (light)
- **Text secondary** : Gris `#b0b0b0` (dark) / Gris `#666666` (light)
- **Background** : Noir profond `#141414` (dark) / Blanc cassé `#fafafa` (light)
- **Surface/Card** : Gris foncé `#1f1f1f` (dark) / Blanc `#ffffff` (light)
- **Border** : Gris `#333333` (dark) / Gris `#e0e0e0` (light)

**À trancher** : Valider cette palette ? Ajuster les teintes pour l'accessibilité (contrast ratio ≥ 4.5:1) ?

---

## 2. Typographie

### Question
Quelle font stack et quelle échelle typographique utiliser ?

### État actuel
Non spécifié dans la roadmap.

### Recommandation (basée sur Trakt.tv)
- **Font principale** : Inter (Google Fonts) — moderne, lisible, excellente pour les data
- **Font secondaire** : system-ui (fallback)
- **Font mono** : JetBrains Mono (pour les données, ratings)
- **Échelle** :
  - `text-xs` : 0.75rem (12px)
  - `text-sm` : 0.875rem (14px)
  - `text-base` : 1rem (16px)
  - `text-lg` : 1.125rem (18px)
  - `text-xl` : 1.25rem (20px)
  - `text-2xl` : 1.5rem (24px)
  - `text-3xl` : 1.875rem (30px)
- **Weights** : 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

**À trancher** : Inter ou autre ? Garder l'échelle Tailwind par défaut ou ajuster ?

---

## 3. Système de spacing

### Question
Quelle base de spacing utiliser pour les paddings, margins, gaps ?

### État actuel
Non spécifié.

### Recommandation (basée sur Trakt.tv)
- **Base** : 4px
- **Échelle** : 4, 8, 12, 16, 20, 24, 32, 40, 48, 64
- **Usage** :
  - Composants internes (padding) : 8px, 12px, 16px
  - Gaps entre éléments : 8px, 16px, 24px
  - Sections : 32px, 48px
  - Page margins : 16px mobile, 24px desktop

**À trancher** : Base 4px ou 8px ? Tailwind par défaut (4px) ou custom ?

---

## 4. Border radius & Elevations

### Question
Quelle philosophie de coins arrondis et d'ombres ?

### État actuel
Non spécifié.

### Recommandation (basée sur Trakt.tv)
- **Border radius** :
  - `rounded-sm` : 2px
  - `rounded-md` : 6px
  - `rounded-lg` : 8px
  - `rounded-xl` : 12px
  - `rounded-full` : 9999px (avatars, badges)
- **Shadows** :
  - `shadow-sm` : `0 1px 2px rgba(0,0,0,0.3)`
  - `shadow-md` : `0 4px 6px rgba(0,0,0,0.4)`
  - `shadow-lg` : `0 10px 15px rgba(0,0,0,0.5)`
  - **Pas de shadow sur dark mode** — préférer des bordures subtiles `border border-white/10`

**À trancher** : Coins arrondis ou carrés ? Shadows sur dark ?

---

## 5. Design du système de notation (ratings 0-10)

### Question
Comment afficher les étoiles/numerals pour les ratings 0-10 avec demi-étoiles ?

### État actuel
La roadmap prévoit `RatingInput.tsx` avec "étoiles 0-10, demi-étoiles" mais sans direction visuelle.

### Recommandation (basée sur Trakt.tv + IMDB)
- **Affichage public** : Numéral `8.5/10` en texte + petite barre visuelle (optionnel)
- **Input utilisateur** : 
  - 5 étoiles pleines = 10 points → chaque étoile = 2 points
  - Click gauche = +1, click droit = -1 (ou toggle 0.5)
  - Hover : preview de la note
  - Couleur étoile remplie : `#ffc107` (jaune)
  - Couleur étoile vide : `#4a4a4a` (dark) / `#d0d0d0` (light)
- **Alternatives** :
  - Option A : 10 petits ronds cliquables (style Netflix)
  - Option B : Slider horizontal 0-10
  - Option C : 5 étoiles avec demi-étoiles SVG

**À trancher** : Style étoiles vs slider vs ronds ? Demi-étoiles obligatoires ?

---

## 6. Watch Button & États visuels

### Question
Comment représenter visuellement les états "vu / non-vu / en cours" ?

### État actuel
Les endpoints existent (`POST /watches`, `DELETE /watches/:id`) mais le design n'est pas défini.

### Recommandation (basée sur Trakt.tv)
- **Bouton "Marquer comme vu"** :
  - Défaut : outline_button avec icône œeil + "Marquer comme vu"
  - Actif (vu) : filled_button vert avec icône check + "Vu"
  - Hover : légère élévation
- **Indicateur de statut sur les cards** :
  - Pastille verte "Vu" en haut à droite de l'affiche
  - Pastille bleue "En cours" pour les séries en cours
- **Check visuel dans les listes d'épisodes** :
  - Checkmark circulaire vert sur l'affiche de l'épisode
  - Opacité réduite (0.6) pour les épisodes vus

**À trancher** : Check overlay ou badge séparé ? Couleur verte ou autre ?

---

## 7. Cards & Layout

### Question
Quel style pour les cards titre/personne et la grid layout ?

### État actuel
`TitleCard`, `PersonCard` sont prévus mais sans spécification visuelle.

### Recommandation (basée sur Trakt.tv)
- **TitleCard** :
  - Affiche 2:3 (poster mode) avec border-radius 6px
  - Hover : zoom léger (scale 1.05) + ombre portée
  - Overlay en bas : titre + note (si disponible)
  - Badge type (film/serie) en haut à gauche
- **TitleCard (alternative compact)** :
  - Mode paysage 16:9 pour les grids serrées
  - Titre sous l'image
- **PersonCard** :
  - Portrait circulaire ou rectangulaire avec border-radius 8px
  - Nom + rôle principal en dessous
- **Grid** :
  - Desktop : 5-6 colonnes posters
  - Tablet : 3-4 colonnes
  - Mobile : 2 colonnes
  - Gap : 16px

**À trancher** : Poster 2:3 ou backdrop 16:9 ? Grid responsive à combien de colonnes ?

---

## 8. Animations & micro-interactions

### Question
Quelles animations utiliser pour les transitions, loaders, toasts ?

### État actuel
La roadmap mentionne Framer Motion mais pas les cas d'usage précis.

### Recommandation (basée sur Trakt.tv)
- **Transitions de page** : Fade in/out (200ms)
- **Modals/Dialogs** : Slide up + fade (300ms)
- **Cards hover** : Scale 1.03 + shadow (200ms)
- **Buttons** : 
  - Hover : background darken 10% (100ms)
  - Active : scale 0.98 (50ms)
- **Loaders** :
  - Spinner circulaire (indeterminate) — composant `LoadingSpinner`
  - Skeleton screens pour les grids/listes
- **Toasts/Notifications** : Slide from top + fade (300ms), auto-dismiss 5s
- **Carousel** : Slide horizontal avec snap points

**À trancher** : Animations partout ou minimalistes ? Durées standard (100/200/300ms) ?

---

## 9. Empty states & Illustrations

### Question
Comment afficher les listes vides (pas de watchlist, pas de résultats) ?

### État actuel
Non spécifié.

### Recommandation (basée sur Trakt.tv)
- **Style** : Illustration SVG simple + texte + CTA
- **Exemples** :
  - Watchlist vide : "Votre watchlist est vide" + bouton "Explorer les films"
  - Pas de résultats : "Aucun résultat" + suggestions
- **Couleurs** : Gris clair `#666666` pour l'illustration et le texte
- **Pas d'emoji** dans les interfaces (sauf badges notifications)

**À trancher** : Illustrations custom ou icônes simples ?

---

## 10. Responsive breakpoints

### Question
Quels breakpoints utiliser pour le responsive design ?

### État actuel
Non spécifié.

### Recommandation (basée sur Tailwind + Trakt.tv)
- **Mobile** : < 640px (sm) — 1 colonne, menu hamburger
- **Tablet** : 640px - 1024px (md/lg) — 2-3 colonnes
- **Desktop** : > 1024px (lg) — 4-6 colonnes, sidebar visible
- **Wide** : > 1280px (xl) — layout max-width 1280px centré

**À trancher** : Breakpoints standard Tailwind ou custom ?

---

## 11. Dark mode & Thème

### Question
Comment gérer le dark/light mode ? Default ? Persistance ?

### État actuel
La roadmap mentionne "Thème sombre/light avec class strategy" et "Dark mode toggle (persistant dans le store)".

### Recommandation (basée sur Trakt.tv)
- **Default** : Dark mode par défaut (cohérent avec Trakt.tv et l'univers cinéma)
- **Persistance** : localStorage + Zustand store
- **Toggle** : Dans le header, icône lune/soleil
- **Classes Tailwind** : `class` strategy (ajoute `dark:` aux classes)
- **Transitions** : 200ms fade entre les modes

**À trancher** : Dark par défaut ? Ajouter option "auto" (system preference) ?

---

## 12. Wording & Ton de la voix

### Question
Quel ton utiliser pour les labels, messages d'erreur, tooltips ?

### État actuel
Non spécifié.

### Recommandation (basée sur Trakt.tv, français)
- **Ton** : Neutre, concis, informatif
- **Forme** : Tutoiement ("Votre watchlist", "Connectez-vous")
- **Exemples** :
  - "Marquer comme vu" (pas "Ajouter aux visionnés")
  - "Ne plus suivre" (pas "Unfollow")
  - "Notifications" (pas "Alertes")
  - "Supprimer" (pas "Éliminer")
  - "Créer une liste" (pas "Nouvelle liste")
- **Messages d'erreur** : 
  - "Email ou mot de passe incorrect"
  - "Cette liste n'existe pas"
  - "Vous n'avez pas les droits"
- **Tooltips** : Phrases courtes, pas de jargon technique

**À trancher** : Tutoiement ou vouvoiement ? Ton strict ou friendly ?

---

## 13. Accessibilité visuelle

### Question
Quels standards d'accessibilité visuelle appliquer ?

### État actuel
La roadmap mentionne "Contrast ratio ≥ 4.5:1" mais pas les autres détails.

### Recommandation (basée sur WCAG 2.1 AA)
- **Contrastes** : 
  - Texte normal : ≥ 4.5:1
  - Texte large (≥18px) : ≥ 3:1
- **Focus visible** : Ring 2px solid primary sur tous les éléments interactifs
- **Touch targets** : Minimum 44x44px sur mobile
- **Alt text** : Obligatoire sur toutes les images
- **ARIA labels** : Sur les boutons icon-only, inputs, dialogs
- **Semantic HTML** : `<nav>`, `<main>`, `<article>`, etc.

**À trancher** : WCAG 2.1 AA minimum ? Audit automatique (axe) ?

---

## Résumé des points à trancher

| # | Point de design | Priorité | Décision recommandée |
|---|---|---|---|
| 1 | Palette couleurs complète | 🔴 Haute | Basée sur Trakt.tv, primary rouge `#e50914` |
| 2 | Typographie | 🔴 Haute | Inter, échelle Tailwind |
| 3 | Spacing system | 🟡 Moyenne | Base 4px, échelle 4-64 |
| 4 | Border radius & shadows | 🟡 Moyenne | Coins arrondis (6-8px), pas de shadow sur dark |
| 5 | Ratings 0-10 | 🔴 Haute | 5 étoiles pleines = 10, demi-étoiles SVG |
| 6 | Watch button & états | 🔴 Haute | Bouton filled vert + check overlay |
| 7 | Cards & layout | 🔴 Haute | Poster 2:3, grid 5-6 colonnes desktop |
| 8 | Animations | 🟡 Moyenne | Framer Motion, durées 200-300ms |
| 9 | Empty states | 🟢 Basse | Illustrations SVG + CTA |
| 10 | Responsive breakpoints | 🟡 Moyenne | Standard Tailwind (sm/md/lg/xl) |
| 11 | Dark mode | 🔴 Haute | Dark par défaut, toggle dans header |
| 12 | Wording & ton | 🟡 Moyenne | Tutoiement, neutre, concis |
| 13 | Accessibilité | 🔴 Haute | WCAG 2.1 AA minimum |

---

## Prochaine étape

1. Valider/ajuster ce document
2. Une fois validé, créér `apps/web/design-tokens.ts` avec toutes les valeurs par défaut
3. Intégrer les tokens dans `tailwind.config.js` et les composants shadcn/ui
4. Mettre à jour `emdb_roadmap_frontend.md` pour référencer ces documents

---

*Dernière mise à jour : 24 juillet 2026*