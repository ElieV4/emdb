-- ============================================================
-- SCHEMA : movie/serie tracker
-- PostgreSQL - utilise uuid-ossp ou gen_random_uuid() (pgcrypto)
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
    source          TEXT NOT NULL DEFAULT 'tmdb',  -- tmdb, scraping_x, manuel...
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_people_nom ON people(nom);

-- ============================================================
-- TITRES (films + series unifies, type discrimine le reste)
-- ============================================================

CREATE TABLE titles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tmdb_id         INT UNIQUE,
    type            TEXT NOT NULL CHECK (type IN ('film','serie')),
    titre_vo        TEXT NOT NULL,
    titre_vf        TEXT,
    synopsis        TEXT,
    affiche_url     TEXT,
    date_sortie     DATE,
    duree_minutes   INT,                 -- pertinent surtout pour type='film'
    statut_serie    TEXT CHECK (statut_serie IN ('en_cours','terminee','annulee')), -- NULL si film
    note_imdb       NUMERIC(3,1),
    source          TEXT NOT NULL DEFAULT 'tmdb',  -- tmdb, senscritique, scraping_x...
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_titles_type ON titles(type);
CREATE INDEX idx_titles_titre_vo ON titles(titre_vo);

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

CREATE TABLE episodes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id       UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    numero          INT NOT NULL,
    titre           TEXT,
    synopsis        TEXT,
    date_sortie     DATE,
    duree_minutes   INT,
    UNIQUE (season_id, numero)
);

CREATE INDEX idx_episodes_date_sortie ON episodes(date_sortie);

-- ============================================================
-- DISTRIBUTION (table pivot titles <-> people)
-- ============================================================

CREATE TABLE credits (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_id    UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    person_id   UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('acteur','realisateur','scenariste','autre')),
    personnage  TEXT,           -- rempli seulement si role = 'acteur'
    ordre       INT,            -- ordre d'affichage dans la distribution
    source      TEXT NOT NULL DEFAULT 'tmdb',
    UNIQUE (title_id, person_id, role)
);

CREATE INDEX idx_credits_person ON credits(person_id);
CREATE INDEX idx_credits_title ON credits(title_id);

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