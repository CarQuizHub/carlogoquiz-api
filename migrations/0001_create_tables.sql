DROP TABLE IF EXISTS countries;
DROP TABLE IF EXISTS brands;

CREATE TABLE countries (
    id INTEGER PRIMARY KEY,
    country_name TEXT NOT NULL UNIQUE
);

CREATE TABLE brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_name TEXT NOT NULL,
    difficulty INTEGER NOT NULL,
    country_id INTEGER NOT NULL,
    media_id TEXT UNIQUE,
    FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE
);