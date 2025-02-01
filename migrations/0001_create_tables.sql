-- 0001_create_tables.sql

-- Create the media table to store images, audio, etc.
CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_type TEXT NOT NULL,       -- e.g. 'image', 'audio'
    link TEXT NOT NULL,              -- URL to the media asset
    alt_text TEXT                 -- Alternative text for accessibility
);

-- Create the question_templates table to hold static quiz question templates.
CREATE TABLE IF NOT EXISTS question_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_text TEXT NOT NULL,    -- e.g. "What brand logo is this?"
    entity_type TEXT NOT NULL,      -- e.g. 'brand', 'model', 'model:model', etc.
    expected_options INTEGER NOT NULL DEFAULT 4, -- Number of answer options
    comparison_field TEXT,          -- e.g. 'performance', 'production_year'
    media_type_required TEXT        -- e.g. 'image', 'audio'
);

-- Link question templates with difficulty levels
CREATE TABLE IF NOT EXISTS question_template_difficulties (
    question_template_id INTEGER NOT NULL,
    difficulty INTEGER NOT NULL,    -- Difficulty scale (e.g. 1 to 5)
    PRIMARY KEY (question_template_id, difficulty),
    FOREIGN KEY (question_template_id) REFERENCES question_templates(id)
);

-- Create the brands table to store car brand information.
CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,             -- Brand name
    difficulty INTEGER NOT NULL,    -- Recognition difficulty
    country TEXT,                   -- Country of origin (for association questions)
    FOREIGN KEY (media_id) REFERENCES media(id)
);

-- Create the models table to store car model information.
CREATE TABLE IF NOT EXISTS models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL,      -- Reference to the parent brand
    name TEXT NOT NULL,             -- Model name
    difficulty INTEGER NOT NULL,    -- Model recognition difficulty
    performance INTEGER,            -- Performance metric (for speed comparisons)
    production_year INTEGER,        -- Year of production (for age comparisons)
    FOREIGN KEY (brand_id) REFERENCES brands(id),
    FOREIGN KEY (media_id) REFERENCES media(id)
);

-- Create a many-to-many relationship between models and media
CREATE TABLE IF NOT EXISTS model_media (
    model_id INTEGER NOT NULL,
    media_id INTEGER NOT NULL,
    media_usage TEXT NOT NULL,      -- e.g. 'image', 'engine_sound'
    PRIMARY KEY (model_id, media_id),
    FOREIGN KEY (model_id) REFERENCES models(id),
    FOREIGN KEY (media_id) REFERENCES media(id)
);

-- Create a many-to-many relationship between brands and media
CREATE TABLE IF NOT EXISTS brand_media (
    brand_id INTEGER NOT NULL,
    media_id INTEGER NOT NULL,
    media_usage TEXT NOT NULL,      -- e.g. 'logo', 'hidden_logo'
    PRIMARY KEY (brand_id, media_id),
    FOREIGN KEY (brand_id) REFERENCES brands(id),
    FOREIGN KEY (media_id) REFERENCES media(id)
);

