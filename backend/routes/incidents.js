const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { getIo } = require('../io');

const router = express.Router();

const stockage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const suffixe = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `incident-${req.params.id}-${suffixe}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage: stockage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Seules les images sont acceptées'));
    cb(null, true);
  },
});

router.get('/', (req, res) => {
  const incidents = db
    .prepare(
      `SELECT i.*, eq.nom AS equipement_nom, u.nom AS signale_par
       FROM incidents i
       JOIN equipements eq ON eq.id = i.equipement_id
       JOIN utilisateurs u ON u.id = i.utilisateur_id
       ORDER BY i.date_signalement DESC`
    )
    .all();
  res.json(incidents);
});

router.post('/', (req, res) => {
  const { equipement_id, utilisateur_id, description, gravite } = req.body;
  if (!equipement_id || !utilisateur_id || !description || !gravite) {
    return res.status(400).json({ erreur: 'Champs requis manquants' });
  }
  const info = db
    .prepare(
      'INSERT INTO incidents (equipement_id, utilisateur_id, description, gravite, statut) VALUES (?,?,?,?,?)'
    )
    .run(equipement_id, utilisateur_id, description, gravite, 'ouvert');

  db.prepare('UPDATE equipements SET statut = ? WHERE id = ?').run('en_panne', equipement_id);

  const incidentComplet = db
    .prepare(
      `SELECT i.*, eq.nom AS equipement_nom, u.nom AS signale_par
       FROM incidents i JOIN equipements eq ON eq.id = i.equipement_id
       JOIN utilisateurs u ON u.id = i.utilisateur_id WHERE i.id = ?`
    )
    .get(info.lastInsertRowid);
  getIo().emit('incident:nouveau', incidentComplet);

  res.status(201).json({ id: info.lastInsertRowid });
});

router.patch('/:id/statut', (req, res) => {
  const { statut } = req.body;
  db.prepare('UPDATE incidents SET statut = ? WHERE id = ?').run(statut, req.params.id);
  res.json({ ok: true });
});

// Fil de diagnostic à distance (messages liés à un incident)
router.get('/:id/messages', (req, res) => {
  const messages = db
    .prepare(
      `SELECT m.*, u.nom AS auteur, u.role AS auteur_role
       FROM messages_diagnostic m
       JOIN utilisateurs u ON u.id = m.utilisateur_id
       WHERE m.incident_id = ?
       ORDER BY m.date_envoi ASC`
    )
    .all(req.params.id);
  res.json(messages);
});

router.post('/:id/messages', upload.single('image'), (req, res) => {
  const { utilisateur_id, contenu } = req.body;
  if (!utilisateur_id || (!contenu && !req.file)) {
    return res.status(400).json({ erreur: 'Champs requis manquants' });
  }
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;

  db.prepare(
    'INSERT INTO messages_diagnostic (incident_id, utilisateur_id, contenu, image_url) VALUES (?,?,?,?)'
  ).run(req.params.id, utilisateur_id, contenu || '', image_url);
  db.prepare("UPDATE incidents SET statut = 'en_diagnostic' WHERE id = ? AND statut = 'ouvert'").run(
    req.params.id
  );

  const auteur = db.prepare('SELECT nom, role FROM utilisateurs WHERE id = ?').get(utilisateur_id);
  getIo().emit('incident:message', {
    incident_id: Number(req.params.id),
    auteur: auteur.nom,
    auteur_role: auteur.role,
    contenu,
    image_url,
  });

  res.status(201).json({ ok: true, image_url });
});

module.exports = router;
