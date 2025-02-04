-- 0001_create_tables.sql

-- Create the countries table to store country information.
CREATE TABLE IF NOT EXISTS countries (
    id INTEGER PRIMARY KEY,
    country_name TEXT NOT NULL UNIQUE -- Country name
);

-- Create the brands table to store car brand information.
CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_name TEXT NOT NULL,                -- Brand name
    difficulty INTEGER NOT NULL,             -- Recognition difficulty
    country TEXT NOT NULL,                   -- Country of origin (for association questions)
    logo TEXT NOT NULL,                      -- URL to the brand logo
    hidden_logo TEXT NOT NULL                -- URL to the hidden logo
);

/*
-- Create the media table to store images, audio, etc.
CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_type TEXT NOT NULL,     -- e.g. 'image', 'audio'
    url_value TEXT NOT NULL,      -- URL to the media asset
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

-- Create the models table to store car model information.
CREATE TABLE IF NOT EXISTS models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL,      -- Reference to the parent brand
    model_name TEXT NOT NULL,             -- Model name
    difficulty INTEGER NOT NULL,    -- Model recognition difficulty
    performance INTEGER,            -- Performance metric (for speed comparisons)
    production_year INTEGER,        -- Year of production (for age comparisons)
    FOREIGN KEY (brand_id) REFERENCES brands(id),
);
*/
