
const express = require('express');
const router = express.Router();
const db = require('../db'); // Export de votre instance DatabaseSync
const { verifierAuthentification } = require('../middlewares/auth');

router.get('/equipements', verifierAuthentification, (req, res) => {
  try {
    let equipements;

    // Si administrateur ou expert distant sans établissement fixe -> TOUS les équipements
    if (req.utilisateur.role === 'administrateur' || !req.utilisateur.etablissement_id) {
      equipements = db.prepare(`
        SELECT e.*, et.nom AS etablissement_nom
        FROM equipements e
        LEFT JOIN etablissements et ON et.id = e.etablissement_id
        ORDER BY e.id DESC
      `).all();
    } else {
      // Filtrage par établissement de l'utilisateur connecté
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
    console.error('Erreur SQL:', erreur);
    res.status(500).json({ erreur: 'Erreur lors de la récupération des équipements' });
  }
});

module.exports = router;