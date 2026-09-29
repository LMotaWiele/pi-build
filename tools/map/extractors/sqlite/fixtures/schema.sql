-- Regenerate store.db: sqlite3 store.db < schema.sql
CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE books (id INTEGER PRIMARY KEY, author_id INTEGER NOT NULL REFERENCES authors(id), title TEXT);
CREATE TABLE loans (id INTEGER PRIMARY KEY, book_id INTEGER, reader TEXT);
