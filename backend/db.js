const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new DatabaseSync(path.join(__dirname, 'plateforme.db'));
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS utilisateurs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  mot_de_passe TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('personnel_medical','technicien_local','expert_distant','responsable_hospitalier','administrateur'))
);

CREATE TABLE IF NOT EXISTS etablissements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  type TEXT NOT NULL,
  localisation TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS equipements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id),
  nom TEXT NOT NULL,
  type TEXT NOT NULL,
  numero_serie TEXT NOT NULL,
  date_acquisition TEXT,
  statut TEXT NOT NULL DEFAULT 'operationnel' CHECK (statut IN ('operationnel','en_panne','en_maintenance','hors_service'))
);

CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipement_id INTEGER NOT NULL REFERENCES equipements(id),
  utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id),
  description TEXT NOT NULL,
  gravite TEXT NOT NULL CHECK (gravite IN ('faible','moyenne','critique')),
  statut TEXT NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert','en_diagnostic','en_intervention','resolu')),
  date_signalement TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages_diagnostic (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL REFERENCES incidents(id),
  utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id),
  contenu TEXT NOT NULL,
  image_url TEXT,
  date_envoi TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interventions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL REFERENCES incidents(id),
  technicien_id INTEGER NOT NULL REFERENCES utilisateurs(id),
  date_debut TEXT NOT NULL DEFAULT (datetime('now')),
  date_fin TEXT,
  statut TEXT NOT NULL DEFAULT 'planifiee' CHECK (statut IN ('planifiee','en_cours','terminee','validee')),
  rapport TEXT
);

CREATE TABLE IF NOT EXISTS articles_connaissance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id),
  titre TEXT NOT NULL,
  contenu TEXT NOT NULL,
  date_creation TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const count = db.prepare('SELECT COUNT(*) AS n FROM utilisateurs').get().n;
if (count === 0) {
  const insertUser = db.prepare(
    'INSERT INTO utilisateurs (nom, email, mot_de_passe, role) VALUES (?,?,?,?)'
  );
  const motDePasseDemo = bcrypt.hashSync('demo123', 10);
  const motDePasseAdmin = bcrypt.hashSync('321demo', 10);
  insertUser.run('Dr. Rakoto', 'rakoto@sante.mg', motDePasseDemo, 'personnel_medical');
  insertUser.run('Andry - Technicien', 'andry@maintenance.mg', motDePasseDemo, 'technicien_local');
  insertUser.run('Expert Rasoa', 'rasoa@expert.mg', motDePasseDemo, 'expert_distant');
  insertUser.run('Responsable Hery', 'hery@hopital.mg', motDePasseDemo, 'responsable_hospitalier');
  insertUser.run('Admin Plateforme', 'admin@plateforme.mg', motDePasseAdmin, 'administrateur');

  const insertEtab = db.prepare(
    'INSERT INTO etablissements (nom, type, localisation) VALUES (?,?,?)'
  );
  insertEtab.run('CHU Antananarivo', 'Hôpital universitaire', 'Antananarivo');
  insertEtab.run('Hôpital de district Toamasina', 'Hôpital de district', 'Toamasina');
  insertEtab.run('Centre de santé Ambanja', 'Centre de santé de base', 'Ambanja');
  insertEtab.run('Poste de santé rural Ambositra', 'Poste de santé rural', 'Ambositra');

  const insertEquip = db.prepare(
    'INSERT INTO equipements (etablissement_id, nom, type, numero_serie, date_acquisition, statut) VALUES (?,?,?,?,?,?)'
  );
  insertEquip.run(1, 'Moniteur multiparamétrique M1', 'Moniteur multiparamétrique', 'MNT-2024-001', '2024-01-12', 'operationnel');
  insertEquip.run(2, 'Moniteur multiparamétrique M2', 'Moniteur multiparamétrique', 'MNT-2024-002', '2024-01-12', 'operationnel');
  insertEquip.run(1, 'Électrocardiographe E1', 'Électrocardiographe (ECG)', 'ECG-2023-010', '2023-05-20', 'operationnel');
  insertEquip.run(1, 'Échographe portable P1', 'Échographe portable', 'ECH-2022-014', '2022-06-01', 'en_panne');
  insertEquip.run(3, 'Oxymètre de pouls O1', 'Oxymètre de pouls', 'OXY-2024-007', '2024-01-15', 'operationnel');
  insertEquip.run(3, 'Oxymètre de pouls O2', 'Oxymètre de pouls', 'OXY-2024-008', '2024-01-15', 'operationnel');
  insertEquip.run(2, 'Pompe à perfusion PP1', 'Pompe à perfusion', 'PMP-2023-005', '2023-09-03', 'en_maintenance');
  insertEquip.run(4, 'Dispositif de télésurveillance T1', 'Télésurveillance médicale', 'TLS-2024-002', '2024-03-18', 'operationnel');

  const insertIncident = db.prepare(
    'INSERT INTO incidents (equipement_id, utilisateur_id, description, gravite, statut) VALUES (?,?,?,?,?)'
  );
  insertIncident.run(4, 1, "L'échographe portable ne s'allume plus depuis ce matin, batterie suspectée.", 'critique', 'en_diagnostic');
  insertIncident.run(7, 1, 'Alarme de débit intermittente sur la pompe à perfusion.', 'moyenne', 'en_intervention');

  db.prepare(
    'INSERT INTO messages_diagnostic (incident_id, utilisateur_id, contenu) VALUES (?,?,?)'
  ).run(1, 3, "Pouvez-vous vérifier si le témoin de charge de la batterie s'allume ?");
  db.prepare(
    'INSERT INTO messages_diagnostic (incident_id, utilisateur_id, contenu) VALUES (?,?,?)'
  ).run(1, 2, "Non, aucun témoin. Je vérifie le connecteur d'alimentation.");

  db.prepare(
    'INSERT INTO interventions (incident_id, technicien_id, statut) VALUES (?,?,?)'
  ).run(2, 2, 'en_cours');

  const insertArticle = db.prepare(
    'INSERT INTO articles_connaissance (utilisateur_id, titre, contenu) VALUES (?,?,?)'
  );
  insertArticle.run(2, 'Panne fréquente : batterie échographe portable', "Vérifier en premier lieu le connecteur d'alimentation et l'état de la batterie avant tout envoi en réparation. Dans la majorité des cas observés, un simple nettoyage des contacts suffit à résoudre le problème.");
  insertArticle.run(3, 'Moniteur multiparamétrique : dérive des mesures de SpO2', "Une dérive progressive des valeurs de saturation en oxygène est le plus souvent liée à un capteur photopléthysmographique encrassé ou vieilli. Le remplacer avant de suspecter une panne électronique plus profonde.");
  insertArticle.run(2, 'ECG : tracé parasité ou bruité', "Un tracé électrocardiographique instable provient dans la plupart des cas d'électrodes mal positionnées ou usagées, ou d'un câble patient endommagé. Vérifier ces éléments avant toute intervention sur l'appareil lui-même.");
  insertArticle.run(4, 'Oxymètre de pouls : absence totale d\'affichage', "Contrôler d'abord les piles ou la batterie interne, puis le bon enclenchement du capteur digital. Un message d'erreur clignotant indique généralement un capteur mal fixé plutôt qu'une panne matérielle.");
  insertArticle.run(3, 'Pompe à perfusion : alarme de débit intempestive', "Vérifier la présence de bulles d'air dans la tubulure et le bon verrouillage de la cassette. Une alarme récurrente après purge complète peut indiquer un capteur de débit à recalibrer.");
  insertArticle.run(2, 'Dispositif de télésurveillance : perte de connexion réseau', "Avant de suspecter le dispositif lui-même, vérifier la qualité du réseau local (Wi-Fi ou GSM selon le modèle). Un redémarrage complet du boîtier résout la majorité des pertes de connexion ponctuelles.");
  insertArticle.run(4, 'Procédure recommandée avant tout envoi en réparation', "Avant d'escalader un incident vers un envoi en atelier, systématiser trois vérifications de base : alimentation électrique, câblage/connectique, et redémarrage complet de l'équipement. Ces trois points résolvent une part significative des pannes signalées.");
}

module.exports = db;
