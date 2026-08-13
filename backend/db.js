const Database = require('better-sqlite3');
const path = require('path');

// Initialisation de la base de données SQLite
const db = new Database(path.join(__dirname, 'plateforme.db'));

// Activation du mode WAL pour de meilleures performances
db.pragma('journal_mode = WAL');

// Exporter l'instance de la base de données
module.exports = db;