-- ============================================================
-- SCHEMA : movie/serie tracker (eMDB) — v2
-- PostgreSQL - pgcrypto pour gen_random_uuid()
-- Intègre les gaps identifiés en phase de conception :
--   - distinction animation / live-action indépendante du genre
--   - suivi de "next episode to air" pour le calendrier
--   - suivi explicite des séries suivies par un user
--   - log de synchronisation TMDB
--   - triggers updated_at
--   - vues matérialisées pour la dataviz
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- UTILISATEURS
-- ============================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    pseudo          TEXT NOT NULL UNIQUE,
    avatar_url      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- REFERENTIELS
-- ============================================================

CREATE TABLE genres (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom     TEXT NOT NULL UNIQUE,
    tmdb_id INT UNIQUE
);

CREATE TABLE countries (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code    CHAR(2) NOT NULL UNIQUE,   -- ISO 3166-1 alpha-2
    nom     TEXT NOT NULL
);

-- [v3] Référentiel des rôles de crédit (remplace le CHECK figé sur credits.role) :
-- permet d'ajouter des rôles TMDB (producteur, compositeur, monteur...) sans migration de schéma,
-- au lieu de tout aplatir sur 'autre'.
CREATE TABLE roles (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code    TEXT NOT NULL UNIQUE,   -- ex: 'acteur','realisateur','scenariste','producteur','compositeur','photographe','monteur','invite','autre'
    libelle TEXT NOT NULL
);

-- [v3] Studios de production (many-to-many : un titre peut avoir plusieurs studios, cf. TMDB production_companies)
CREATE TABLE studios (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tmdb_id  INT UNIQUE,
    nom      TEXT NOT NULL,
    logo_url TEXT
);

-- ============================================================
-- PERSONNES (acteurs / realisateurs, role porte par credits)
-- ============================================================

CREATE TABLE people (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tmdb_id         INT UNIQUE,
    nom             TEXT NOT NULL,
    genre           TEXT CHECK (genre IN ('homme','femme','autre','non_specifie')),
    date_naissance  DATE,
    pays_id         UUID REFERENCES countries(id),
    photo_url       TEXT,
    bio             TEXT,
    wiki_url        TEXT,   -- [v3] lien Wikipedia, résolu via TMDB external_ids (wikidata_id) + API Wikidata
    source          TEXT NOT NULL DEFAULT 'tmdb',  -- tmdb, scraping_x, manuel...
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_people_nom ON people(nom);

-- ============================================================
-- TITRES (films + series unifies, type discrimine le reste)
-- ============================================================

CREATE TABLE titles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tmdb_id                 INT UNIQUE,
    type                    TEXT NOT NULL CHECK (type IN ('film','serie')),
    titre_vo                TEXT NOT NULL,
    titre_vf                TEXT,
    synopsis                TEXT,
    affiche_url             TEXT,
    date_sortie             DATE,
    duree_minutes           INT,                 -- pertinent surtout pour type='film'
    statut_serie            TEXT CHECK (statut_serie IN ('en_cours','terminee','annulee')), -- NULL si film ; suivi calendrier (episodes a venir ou non)
    statut_production       TEXT CHECK (statut_production IN ('rumeur','prevu','en_tournage','post_production','sorti','annule')), -- [v3] cycle de vie avant/apres sortie, valable film ET serie (cf. TMDB "status")
    note_imdb               NUMERIC(3,1),
    is_animation            BOOLEAN NOT NULL DEFAULT false,   -- [v2] dérivé du genre TMDB "Animation" à l'import, dénormalisé pour perf dataviz
    next_episode_air_date   DATE,                              -- [v2] rempli depuis next_episode_to_air (TMDB), NULL si film ou série terminée
    source                  TEXT NOT NULL DEFAULT 'tmdb',  -- tmdb, senscritique, scraping_x...
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_titles_type ON titles(type);
CREATE INDEX idx_titles_titre_vo ON titles(titre_vo);
CREATE INDEX idx_titles_date_sortie ON titles(date_sortie);          -- [v2] tri chronologique / calendrier
CREATE INDEX idx_titles_note_imdb ON titles(note_imdb);              -- [v2] filtres dataviz

CREATE TABLE title_genres (
    title_id    UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    genre_id    UUID NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (title_id, genre_id)
);

CREATE TABLE title_countries (
    title_id    UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    country_id  UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
    PRIMARY KEY (title_id, country_id)
);

-- [v3] many-to-many titre <-> studios de production
CREATE TABLE title_studios (
    title_id    UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    studio_id   UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
    PRIMARY KEY (title_id, studio_id)
);

-- ============================================================
-- SAISONS / EPISODES (uniquement pour titles.type = 'serie')
-- ============================================================

CREATE TABLE seasons (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_id    UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    numero      INT NOT NULL,
    titre       TEXT,
    date_sortie DATE,
    synopsis    TEXT,
    UNIQUE (title_id, numero)
);

CREATE INDEX idx_seasons_title ON seasons(title_id);   -- [v2] explicite, en plus de la FK

CREATE TABLE episodes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id       UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    numero          INT NOT NULL,
    titre           TEXT,
    synopsis        TEXT,
    date_sortie     DATE,
    duree_minutes   INT,
    image_url       TEXT,   -- [v3] TMDB still_path (capture d'écran de l'épisode)
    UNIQUE (season_id, numero)
);

CREATE INDEX idx_episodes_date_sortie ON episodes(date_sortie);

-- ============================================================
-- DISTRIBUTION (table pivot titles <-> people, [v3] + episodes en option)
-- ============================================================

CREATE TABLE credits (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_id    UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    person_id   UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    episode_id  UUID REFERENCES episodes(id) ON DELETE CASCADE,  -- [v3] NULL = credit au niveau du titre entier ; rempli = guest star/crew specifique a un episode (cf. TMDB guest_stars par episode)
    role_id     UUID NOT NULL REFERENCES roles(id),              -- [v3] remplace l'ancien CHECK figé role TEXT IN (...)
    personnage  TEXT,           -- rempli seulement si le role est de type acteur
    ordre       INT,            -- ordre d'affichage dans la distribution
    source      TEXT NOT NULL DEFAULT 'tmdb',
    UNIQUE (title_id, person_id, role_id, episode_id)
    -- ATTENTION (meme caveat que user_ratings, cf. Phase 1.5) : Postgres ignore les NULL
    -- dans les contraintes UNIQUE, donc plusieurs credits avec episode_id NULL et memes
    -- title_id/person_id/role_id ne sont PAS bloques par cette contrainte seule.
    -- A couvrir par un test d'integration dedie, comme pour user_ratings.
);

CREATE INDEX idx_credits_person ON credits(person_id);
CREATE INDEX idx_credits_title ON credits(title_id);
CREATE INDEX idx_credits_episode ON credits(episode_id);
CREATE INDEX idx_credits_role ON credits(role_id);

-- ============================================================
-- VISIONNAGES (vue datee, a la maille titre OU episode)
-- ============================================================

CREATE TABLE user_watches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title_id    UUID REFERENCES titles(id) ON DELETE CASCADE,
    episode_id  UUID REFERENCES episodes(id) ON DELETE CASCADE,
    date_vue    DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_watch_target CHECK (
        (title_id IS NOT NULL AND episode_id IS NULL) OR
        (title_id IS NULL AND episode_id IS NOT NULL)
    )
);

CREATE INDEX idx_watches_user ON user_watches(user_id);
CREATE INDEX idx_watches_title ON user_watches(title_id);
CREATE INDEX idx_watches_episode ON user_watches(episode_id);
CREATE INDEX idx_watches_user_date ON user_watches(user_id, date_vue);   -- [v2] agrégations dataviz par période

-- ============================================================
-- NOTES / COMMENTAIRES (titre entier OU episode independamment)
-- ============================================================

CREATE TABLE user_ratings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title_id    UUID REFERENCES titles(id) ON DELETE CASCADE,
    episode_id  UUID REFERENCES episodes(id) ON DELETE CASCADE,
    note_perso  NUMERIC(3,1) CHECK (note_perso BETWEEN 0 AND 10),
    commentaire TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_rating_target CHECK (
        (title_id IS NOT NULL AND episode_id IS NULL) OR
        (title_id IS NULL AND episode_id IS NOT NULL)
    ),
    UNIQUE (user_id, title_id),
    UNIQUE (user_id, episode_id)
);

CREATE INDEX idx_ratings_user ON user_ratings(user_id);

-- [v2] trigger : auto-update de updated_at à chaque modification d'une note
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_ratings_updated_at
    BEFORE UPDATE ON user_ratings
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================
-- LISTES (a voir, personnalisees) + partage
-- ============================================================

CREATE TABLE user_lists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom         TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('a_voir','personnalisee')),
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE list_items (
    list_id     UUID NOT NULL REFERENCES user_lists(id) ON DELETE CASCADE,
    title_id    UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    position    INT,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (list_id, title_id)
);

CREATE TABLE list_shares (
    list_id             UUID NOT NULL REFERENCES user_lists(id) ON DELETE CASCADE,
    shared_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission          TEXT NOT NULL CHECK (permission IN ('lecture','edition')) DEFAULT 'lecture',
    shared_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (list_id, shared_with_user_id)
);

-- ============================================================
-- SUIVI DE SERIES [v2] (pour calendrier + notifications ciblees)
-- ============================================================

CREATE TABLE user_follows_serie (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title_id    UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    followed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, title_id),
    CONSTRAINT chk_follow_is_serie CHECK (
        -- pas de contrainte SQL directe possible vers titles.type ici sans trigger ;
        -- a valider en appli (title.type = 'serie') ou via trigger BEFORE INSERT si on veut du dur
        true
    )
);

CREATE INDEX idx_follows_title ON user_follows_serie(title_id);

-- ============================================================
-- RECOMMANDATIONS ALGO ("connexes") - precalculees en batch
-- ============================================================

CREATE TABLE title_recommendations (
    title_id        UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    recommended_id  UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    score           NUMERIC(5,4) NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (title_id, recommended_id),
    CHECK (title_id <> recommended_id)
);

CREATE TABLE person_recommendations (
    person_id       UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    recommended_id  UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    score           NUMERIC(5,4) NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (person_id, recommended_id),
    CHECK (person_id <> recommended_id)
);

-- ============================================================
-- NOTIFICATIONS (nouveaux episodes suivis, rappels...)
-- ============================================================

CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    episode_id  UUID REFERENCES episodes(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('nouvel_episode','rappel','recommandation')),
    lu          BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE lu = false;

-- ============================================================
-- LOG DE SYNCHRONISATION TMDB [v2]
-- ============================================================

CREATE TABLE tmdb_sync_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tmdb_id     INT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('film','serie','personne')),
    action      TEXT NOT NULL CHECK (action IN ('import','refresh','import_saisons')),
    status      TEXT NOT NULL CHECK (status IN ('succes','echec')),
    error       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_log_tmdb ON tmdb_sync_log(tmdb_id, type);
CREATE INDEX idx_sync_log_status_echec ON tmdb_sync_log(created_at) WHERE status = 'echec';

-- ============================================================
-- FONCTIONS METIER [v2]
-- ============================================================

-- Nombre d'episodes sortis mais non vus par un user pour une serie donnee
CREATE OR REPLACE FUNCTION fn_episodes_non_vus(p_user_id UUID, p_title_id UUID)
RETURNS INT AS $$
    SELECT COUNT(*)::INT
    FROM episodes e
    JOIN seasons s ON s.id = e.season_id
    WHERE s.title_id = p_title_id
      AND e.date_sortie IS NOT NULL
      AND e.date_sortie <= CURRENT_DATE
      AND NOT EXISTS (
          SELECT 1 FROM user_watches uw
          WHERE uw.user_id = p_user_id AND uw.episode_id = e.id
      );
$$ LANGUAGE sql STABLE;

-- Progression (vus / total) par saison pour un user et une serie donnee
CREATE OR REPLACE FUNCTION fn_progress_serie(p_user_id UUID, p_title_id UUID)
RETURNS TABLE(saison INT, vus INT, total INT) AS $$
    SELECT
        s.numero AS saison,
        COUNT(uw.id)::INT AS vus,
        COUNT(e.id)::INT AS total
    FROM seasons s
    JOIN episodes e ON e.season_id = s.id
    LEFT JOIN user_watches uw ON uw.episode_id = e.id AND uw.user_id = p_user_id
    WHERE s.title_id = p_title_id
    GROUP BY s.numero
    ORDER BY s.numero;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- VUES MATERIALISEES [v2] — dataviz (rafraichies par cron, cf. roadmap)
-- ============================================================

CREATE MATERIALIZED VIEW mv_watch_time_by_period AS
SELECT
    uw.user_id,
    date_trunc('week',  uw.date_vue)::DATE AS periode_semaine,
    date_trunc('month', uw.date_vue)::DATE AS periode_mois,
    date_trunc('year',  uw.date_vue)::DATE AS periode_annee,
    SUM(COALESCE(e.duree_minutes, t.duree_minutes, 0)) AS minutes
FROM user_watches uw
LEFT JOIN episodes e ON e.id = uw.episode_id
LEFT JOIN titles   t ON t.id = uw.title_id
GROUP BY uw.user_id, periode_semaine, periode_mois, periode_annee;

CREATE UNIQUE INDEX idx_mv_watch_time_period ON mv_watch_time_by_period(user_id, periode_semaine);

CREATE MATERIALIZED VIEW mv_watch_time_by_genre AS
SELECT
    uw.user_id,
    tg.genre_id,
    SUM(COALESCE(e.duree_minutes, t.duree_minutes, 0)) AS minutes
FROM user_watches uw
LEFT JOIN episodes e ON e.id = uw.episode_id
LEFT JOIN seasons  s ON s.id = e.season_id
LEFT JOIN titles   t ON t.id = COALESCE(uw.title_id, s.title_id)
JOIN title_genres  tg ON tg.title_id = t.id
GROUP BY uw.user_id, tg.genre_id;

CREATE UNIQUE INDEX idx_mv_watch_time_genre ON mv_watch_time_by_genre(user_id, genre_id);

CREATE MATERIALIZED VIEW mv_watch_time_by_country AS
SELECT
    uw.user_id,
    tc.country_id,
    SUM(COALESCE(e.duree_minutes, t.duree_minutes, 0)) AS minutes
FROM user_watches uw
LEFT JOIN episodes e ON e.id = uw.episode_id
LEFT JOIN seasons  s ON s.id = e.season_id
LEFT JOIN titles   t ON t.id = COALESCE(uw.title_id, s.title_id)
JOIN title_countries tc ON tc.title_id = t.id
GROUP BY uw.user_id, tc.country_id;

CREATE UNIQUE INDEX idx_mv_watch_time_country ON mv_watch_time_by_country(user_id, country_id);

CREATE MATERIALIZED VIEW mv_watch_time_by_animation AS
SELECT
    uw.user_id,
    t.is_animation,
    SUM(COALESCE(e.duree_minutes, t.duree_minutes, 0)) AS minutes
FROM user_watches uw
LEFT JOIN episodes e ON e.id = uw.episode_id
LEFT JOIN seasons  s ON s.id = e.season_id
LEFT JOIN titles   t ON t.id = COALESCE(uw.title_id, s.title_id)
GROUP BY uw.user_id, t.is_animation;

CREATE UNIQUE INDEX idx_mv_watch_time_anim ON mv_watch_time_by_animation(user_id, is_animation);

CREATE MATERIALIZED VIEW mv_watch_count_by_genre AS
SELECT
    uw.user_id,
    tg.genre_id,
    COUNT(*) AS nb_items
FROM user_watches uw
LEFT JOIN episodes e ON e.id = uw.episode_id
LEFT JOIN seasons  s ON s.id = e.season_id
LEFT JOIN titles   t ON t.id = COALESCE(uw.title_id, s.title_id)
JOIN title_genres  tg ON tg.title_id = t.id
GROUP BY uw.user_id, tg.genre_id;

CREATE UNIQUE INDEX idx_mv_watch_count_genre ON mv_watch_count_by_genre(user_id, genre_id);

-- [v3] Vues matérialisées supplémentaires pour le comptage (symétriques aux vues watch_time)
CREATE MATERIALIZED VIEW mv_watch_count_by_period AS
SELECT
    uw.user_id,
    date_trunc('week',  uw.date_vue)::DATE AS periode_semaine,
    date_trunc('month', uw.date_vue)::DATE AS periode_mois,
    date_trunc('year',  uw.date_vue)::DATE AS periode_annee,
    COUNT(*) AS nb_items
FROM user_watches uw
GROUP BY uw.user_id, periode_semaine, periode_mois, periode_annee;

CREATE UNIQUE INDEX idx_mv_watch_count_period ON mv_watch_count_by_period(user_id, periode_semaine);

CREATE MATERIALIZED VIEW mv_watch_count_by_country AS
SELECT
    uw.user_id,
    tc.country_id,
    COUNT(*) AS nb_items
FROM user_watches uw
LEFT JOIN episodes e ON e.id = uw.episode_id
LEFT JOIN seasons  s ON s.id = e.season_id
LEFT JOIN titles   t ON t.id = COALESCE(uw.title_id, s.title_id)
JOIN title_countries tc ON tc.title_id = t.id
GROUP BY uw.user_id, tc.country_id;

CREATE UNIQUE INDEX idx_mv_watch_count_country ON mv_watch_count_by_country(user_id, country_id);

CREATE MATERIALIZED VIEW mv_watch_count_by_animation AS
SELECT
    uw.user_id,
    t.is_animation,
    COUNT(*) AS nb_items
FROM user_watches uw
LEFT JOIN episodes e ON e.id = uw.episode_id
LEFT JOIN seasons  s ON s.id = e.season_id
LEFT JOIN titles   t ON t.id = COALESCE(uw.title_id, s.title_id)
GROUP BY uw.user_id, t.is_animation;

CREATE UNIQUE INDEX idx_mv_watch_count_anim ON mv_watch_count_by_animation(user_id, is_animation);

-- NB : REFRESH MATERIALIZED VIEW CONCURRENTLY exige un index UNIQUE sur chaque MV (fait ci-dessus)
-- Rafraichissement a orchestrer via le worker (cron nocturne), cf. roadmap phase 1.4