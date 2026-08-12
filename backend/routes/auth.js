const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../config');
const verifierAuthentification = require('../middleware/auth');
const verifierAdmin = require('../middleware/admin');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, mot_de_passe } = req.body;

  const user = db.prepare('SELECT * FROM utilisateurs WHERE email = ?').get(email);
  if (!user) {
    return res.status(401).json({ erreur: 'Identifiants incorrects' });
  }

  const motDePasseValide = bcrypt.compareSync(mot_de_passe, user.mot_de_passe);
  if (!motDePasseValide) {
    return res.status(401).json({ erreur: 'Identifiants incorrects' });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });

  res.json({
    token,
    utilisateur: { id: user.id, nom: user.nom, email: user.email, role: user.role },
  });
});

// Liste des utilisateurs (utilisée notamment pour assigner un technicien à une intervention)
router.get('/utilisateurs', verifierAuthentification, (req, res) => {
  const utilisateurs = db.prepare('SELECT id, nom, email, role FROM utilisateurs').all();
  res.json(utilisateurs);
});

// Création d'un nouvel utilisateur — réservée à l'administrateur
router.post('/utilisateurs', verifierAuthentification, verifierAdmin, (req, res) => {
  const { nom, email, mot_de_passe, role } = req.body;
  const rolesValides = ['personnel_medical', 'technicien_local', 'expert_distant', 'responsable_hospitalier', 'administrateur'];

  if (!nom || !email || !mot_de_passe || !role) {
    return res.status(400).json({ erreur: 'Champs requis manquants' });
  }
  if (!rolesValides.includes(role)) {
    return res.status(400).json({ erreur: 'Rôle invalide' });
  }

  const existant = db.prepare('SELECT id FROM utilisateurs WHERE email = ?').get(email);
  if (existant) {
    return res.status(409).json({ erreur: 'Un compte existe déjà avec cet email' });
  }

  const motDePasseHache = bcrypt.hashSync(mot_de_passe, 10);
  const info = db
    .prepare('INSERT INTO utilisateurs (nom, email, mot_de_passe, role) VALUES (?,?,?,?)')
    .run(nom, email, motDePasseHache, role);

  res.status(201).json({ id: info.lastInsertRowid, nom, email, role });
});

module.exports = router;
