// À utiliser après verifierAuthentification : suppose que req.utilisateur existe déjà.
function verifierAdmin(req, res, next) {
  if (!req.utilisateur || req.utilisateur.role !== 'administrateur') {
    return res.status(403).json({ erreur: 'Action réservée à l\'administrateur' });
  }
  next();
}

module.exports = verifierAdmin;
