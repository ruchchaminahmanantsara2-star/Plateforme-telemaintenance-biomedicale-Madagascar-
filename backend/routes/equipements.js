const express = require('express');
const db = require('../db');
const { verifierAuthentification } = require('../middlewares/auth');

const router = express.Router();

// GET /api/equipements/etablissements
router.get('/etablissements', verifierAuthentification, (req, res) => {
  try {
    const etablissements = db.prepare('SELECT * FROM etablissements ORDER BY nom').all();
    res.json(etablissements);
  } catch (erreur) {
    res.status(500).json({ erreur: 'Erreur lors de la récupération des établissements' });
  }
});

// GET /api/equipements
router.get('/', verifierAuthentification, (req, res) => {
  try {
    let equipements;

    if (req.utilisateur.role === 'administrateur') {
      equipements = db.prepare(`
        SELECT e.*, et.nom AS etablissement_nom
        FROM equipements e
        LEFT JOIN etablissements et ON et.id = e.etablissement_id
        ORDER BY e.id DESC
      `).all();
    } else {
      equipements = db.prepare(`
        SELECT e.*, et.nom AS etablissement_nom
        FROM equipements e
        LEFT JOIN etablissements et ON et.id = e.etablissement_id
        WHERE e.etablissement_id = ?
        ORDER BY e.id DESC
      `).all(req.utilisateur.etablissement_id);
    }

    res.json(equipements);
  } catch (erreur) {
    res.status(500).json({ erreur: 'Erreur lors de la récupération des équipements' });
  }
});

// POST /api/equipements (Création d'un équipement)
router.post('/', verifierAuthentification, (req, res) => {
  let { etablissement_id, nom, type, numero_serie, date_acquisition } = req.body;

  // 🔒 SÉCURITÉ : Un non-admin ne peut créer des équipements que dans SON établissement
  if (req.utilisateur.role !== 'administrateur') {
    etablissement_id = req.utilisateur.etablissement_id;
  }

  if (!etablissement_id || !nom || !type || !numero_serie) {
    return res.status(400).json({ erreur: 'Champs requis manquants' });
  }

  try {
    const info = db
      .prepare(
        'INSERT INTO equipements (etablissement_id, nom, type, numero_serie, date_acquisition, statut) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(etablissement_id, nom, type, numero_serie, date_acquisition || null, 'operationnel');

    res.status(201).json({ id: info.lastInsertRowid });
  } catch (erreur) {
    if (erreur.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ erreur: 'Le numéro de série existe déjà' });
    }
    res.status(500).json({ erreur: "Erreur lors de la création de l'équipement" });
  }
});

// PATCH /api/equipements/:id/statut (Changement de statut)
router.patch('/:id/statut', verifierAuthentification, (req, res) => {
  const { statut } = req.body;
  const { id } = req.params;

  const statutsAutorises = ['operationnel', 'en_panne', 'en_maintenance', 'hors_service'];
  if (!statut || !statutsAutorises.includes(statut)) {
    return res.status(400).json({ erreur: 'Statut invalide ou absent' });
  }

  try {
    let info;

    // 🔒 SÉCURITÉ : Un non-admin ne peut modifier QUE les équipements de son établissement
    if (req.utilisateur.role === 'administrateur') {
      info = db
        .prepare('UPDATE equipements SET statut = ? WHERE id = ?')
        .run(statut, id);
    } else {
      info = db
        .prepare('UPDATE equipements SET statut = ? WHERE id = ? AND etablissement_id = ?')
        .run(statut, id, req.utilisateur.etablissement_id);
    }

    if (info.changes === 0) {
      return res.status(404).json({ erreur: 'Équipement non trouvé ou non autorisé' });
    }

    res.json({ ok: true, message: 'Statut mis à jour avec succès' });
  } catch (erreur) {
    res.status(500).json({ erreur: 'Erreur lors de la mise à jour du statut' });
  }
});

module.exports = router;