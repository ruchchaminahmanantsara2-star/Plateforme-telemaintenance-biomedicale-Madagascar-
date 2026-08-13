# Télémaintenance-biomédicale-Madagascar

Prototype fonctionnel réalisé pour le mini-projet de soutenance DTS (technologies biomédicales).

## Architecture

- **Backend** : Node.js + Express + SQLite (module intégré `node:sqlite`, aucune dépendance native à compiler) — aucune installation de serveur de base de données séparée n'est nécessaire, tout est stocké dans un fichier `plateforme.db` créé automatiquement.
  > Un message `ExperimentalWarning: SQLite is an experimental feature` peut s'afficher au démarrage : c'est normal, sans conséquence.
- **Frontend** : HTML/CSS/JavaScript natif (aucun framework, aucune étape de build).

## Modules implémentés

- **Authentification sécurisée** : mots de passe hachés (bcryptjs) + sessions par token JWT (8h de validité), toutes les routes de l'API (hors connexion) sont protégées
- **Gestion des utilisateurs réservée à l'administrateur** : seul le compte administrateur peut créer de nouveaux comptes utilisateurs (menu "Utilisateurs", visible uniquement pour ce rôle)
- Gestion des équipements (inventaire, statut, ajout) — répartis sur 4 établissements de santé représentatifs du contexte malgache
- Signalement des incidents
- Diagnostic à distance (fil de messages + envoi de photos, lié à chaque incident)
- **Visioconférence intégrée** (Jitsi Meet) avec partage d'écran natif
- Suivi des interventions (planification, rapport, clôture)
- Base de connaissances collaborative (7 articles de démonstration)
- Tableau de bord avec indicateurs
- **Notifications en temps réel** (Socket.io)

## Installation (dans VS Code)

### 1. Ouvrir le dossier
Ouvre le dossier `plateforme-telemaintenance` dans VS Code (`File > Open Folder`).

### 2. Lancer le backend
```bash
cd backend
npm install
npm start
```
Tu dois voir : `API de la plateforme de télémaintenance démarrée sur http://localhost:3001`

### 3. Lancer le frontend
Ouvre `frontend/index.html` directement dans ton navigateur (double-clic), ou utilise l'extension VS Code **Live Server**.

⚠️ **Important** : `frontend/app.js` pointe par défaut vers le backend déployé en ligne (`https://Plateforme-telemaintenance-biomedicale-Madagascar-.onrender.com`), pas vers `localhost`. Si tu veux tester avec ton backend local, remplace en haut de `app.js` :
```javascript
const API = 'http://localhost:3001/api';
```
et dans `connecterNotificationsTempsReel()` :
```javascript
socket = io('http://localhost:3001');
```

### 4. Se connecter
Utilise un des comptes ci-dessous.

## Comptes de démonstration

| Email | Mot de passe | Rôle |
|---|---|---|
| rakoto@sante.mg | demo123 | Personnel médical |
| andry@maintenance.mg | demo123 | Technicien local |
| rasoa@expert.mg | demo123 | Expert distant |
| hery@hopital.mg | demo123 | Responsable hospitalier |
| admin@plateforme.mg | **321demo** | Administrateur |

Le mot de passe administrateur est volontairement différent des autres comptes.

## Établissements et équipements

| Établissement | Type | Équipements |
|---|---|---|
| CHU Antananarivo | Hôpital universitaire | Moniteur M1 · ECG · Échographe (en panne) |
| Hôpital de district Toamasina | Hôpital de district | Moniteur M2 · Pompe à perfusion (en maintenance) |
| Centre de santé Ambanja | Centre de santé de base | 2 oxymètres de pouls |
| Poste de santé rural Ambositra | Poste de santé rural | Dispositif de télésurveillance |

## Gestion des utilisateurs (administrateur uniquement)

Connecté en tant qu'administrateur (`admin@plateforme.mg`), un menu **"Utilisateurs"** apparaît dans la barre latérale. Il permet de créer un nouveau compte (nom, email, mot de passe, rôle). Cette action est protégée côté serveur (`POST /api/auth/utilisateurs`) : toute tentative par un compte non-administrateur est rejetée avec une erreur 403.

## Évaluation des performances

```bash
cd backend
node test-performance.js
```
Pour tester la version en ligne :
```bash
node test-performance.js https://medilink-plateforme-telemaintenance.onrender.com
```

## Déploiement en ligne

- **Backend** : Render — `https://Plateforme-telemaintenance-biomedicale-Madagascar-.onrender.com`
- **Frontend** : Netlify — `https://medilink-chutanambao.netlify.app`

Pour republier après une modification :
```bash
git add .
git commit -m "Message décrivant le changement"
git push
```
Render et Netlify redéploient automatiquement à chaque envoi sur la branche principale.

⚠️ Sur l'offre gratuite de Render, le serveur se met en veille après une période d'inactivité (premher chargement plus lent, jusqu'à 50 secondes), et le disque (photos uploadées) est réinitialisé à chaque redéploiement.

## Pistes d'évolution pour la suite du projet

- Mode hors-ligne pour le signalement d'incidents en zone à connectivité limitée, avec synchronisation différée
- Stockage des photos uploadées sur un service persistant (ex. Cloudinary, S3)
- Extension du périmètre équipements aux concentrateurs d'oxygène et aspirateurs médicaux (identifiés comme critiques par l'enquête de terrain)
- Auto-hébergement d'un serveur Jitsi dédié (le prototype utilise actuellement le serveur public meet.jit.si)
- Migration vers PostgreSQL pour un déploiement en production
- Gestion des rôles plus fine (autorisations différenciées par action)
