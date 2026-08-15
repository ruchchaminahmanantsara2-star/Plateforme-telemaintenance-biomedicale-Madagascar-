// ==========================================
// CONFIGURATION API & SOCKET.IO
// ==========================================
const API = 'https://plateforme-telemaintenance-biomedicale-ye6r.onrender.com/api';
// Fonction globale pour communiquer avec l'API backend
async function api(endpoint, options = {}) {
  const token = localStorage.getItem('medilink_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(API + endpoint, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.erreur || 'Une erreur est survenue lors de la requête.');
  }
  return data;
}

// Map des rôles pour l'affichage propre
const LABELS_ROLE = {
  personnel_medical: 'Personnel médical',
  technicien_local: 'Technicien local',
  expert_distant: 'Expert distant',
  responsable_hospitalier: 'Responsable hospitalier',
  administrateur: 'Administrateur'
};

// Fonction pour générer des badges HTML
function badge(texte, classe = 'badge-vert') {
  return `<span class="badge ${classe}">${texte}</span>`;
}

// ==========================================
// INITIALISATION DE L'APPLICATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const btnLogin = document.getElementById('btn-login');
  const btnLogout = document.getElementById('btn-logout');
  const inputEmail = document.getElementById('login-email');
  const inputMdp = document.getElementById('login-mdp');

  // 1. Événement du bouton "Se connecter"
  if (btnLogin) {
    btnLogin.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const email = inputEmail.value.trim();
      const mot_de_passe = inputMdp.value;
      const erreurEl = document.getElementById('login-erreur');

      if (erreurEl) erreurEl.style.display = 'none';

      if (!email || !mot_de_passe) {
        if (erreurEl) {
          erreurEl.textContent = 'Veuillez remplir l’email et le mot de passe.';
          erreurEl.style.display = 'block';
        }
        return;
      }

      try {
        const res = await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, mot_de_passe })
        });

        // Sauvegarder la session
        localStorage.setItem('medilink_token', res.token);
        localStorage.setItem('medilink_user', JSON.stringify(res.utilisateur));

        // Initialiser l'interface utilisateur
        initialiserInterface(res.utilisateur);

      } catch (err) {
        if (erreurEl) {
          erreurEl.textContent = err.message || 'Identifiants incorrects.';
          erreurEl.style.display = 'block';
        }
      }
    });
  }

  // 2. Connexion par la touche "Entrée"
  if (inputMdp) {
    inputMdp.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') btnLogin.click();
    });
  }

  // 3. Déconnexion
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('medilink_token');
      localStorage.removeItem('medilink_user');
      document.getElementById('app').classList.add('hidden');
      document.getElementById('ecran-login').classList.remove('hidden');
    });
  }

  // 4. Vérifier si un utilisateur est déjà connecté
  const userStocke = localStorage.getItem('medilink_user');
  const tokenStocke = localStorage.getItem('medilink_token');

  if (userStocke && tokenStocke) {
    try {
      const user = JSON.parse(userStocke);
      initialiserInterface(user);
    } catch (e) {
      localStorage.clear();
    }
  }
});

// ==========================================
// INTERFACE & NAVIGATION
// ==========================================
function initialiserInterface(user) {
  // Masquer l'écran de login et afficher l'application
  document.getElementById('ecran-login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  // Mettre à jour les informations utilisateur
  document.getElementById('user-nom').textContent = user.nom;
  document.getElementById('user-role').textContent = LABELS_ROLE[user.role] || user.role;

  // Afficher le menu Utilisateurs si administrateur
  const navUtilisateurs = document.getElementById('nav-utilisateurs');
  if (navUtilisateurs) {
    if (user.role === 'administrateur') {
      navUtilisateurs.classList.remove('hidden');
    } else {
      navUtilisateurs.classList.add('hidden');
    }
  }

  // Activer la navigation par onglets
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      navItems.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const vueCible = btn.getAttribute('data-vue');
      changerVue(vueCible);
    });
  });

  // Charger la vue par défaut (Dashboard)
  changerVue('dashboard');
}

function changerVue(nomVue) {
  const vues = document.querySelectorAll('.vue');
  vues.forEach((v) => v.classList.add('hidden'));

  const vueActive = document.getElementById(`vue-${nomVue}`);
  if (vueActive) {
    vueActive.classList.remove('hidden');

    // Charger les données de la vue demandée
    if (nomVue === 'utilisateurs') renderUtilisateurs();
    // Ajoutez ici les appels aux autres vues si besoin (ex: renderEquipements(), etc.)
  }
}

// ==========================================
// VUE UTILISATEURS (ADMIN)
// ==========================================
async function renderUtilisateurs() {
  const el = document.getElementById('vue-utilisateurs');
  if (!el) return;

  try {
    const utilisateurs = await api('/auth/utilisateurs');

    el.innerHTML = `
      <div class="entete-vue">
        <div>
          <h1>Utilisateurs</h1>
          <p class="sous-titre">Gestion des comptes et utilisateurs de la plateforme.</p>
        </div>
        <button class="btn-secondaire" id="btn-nouvel-utilisateur">+ Ajouter un utilisateur</button>
      </div>
      
      <div class="panneau-form hidden" id="form-utilisateur">
        <div><label>Nom complet</label><input id="ut-nom" type="text" placeholder="Ex: Jean Dupont"></div>
        <div><label>Email</label><input id="ut-email" type="email" placeholder="email@exemple.mg"></div>
        <div><label>Mot de passe</label><input id="ut-mdp" type="password" placeholder="Mot de passe"></div>
        <div><label>Rôle</label>
          <select id="ut-role">
            <option value="personnel_medical">Personnel médical</option>
            <option value="technicien_local">Technicien local</option>
            <option value="expert_distant">Expert distant</option>
            <option value="responsable_hospitalier">Responsable hospitalier</option>
            <option value="administrateur">Administrateur</option>
          </select>
        </div>
        <div class="pleine-largeur">
          <button class="btn-primary" id="btn-enregistrer-utilisateur">Créer le compte</button>
        </div>
        <p id="ut-erreur" class="pleine-largeur" style="color:#B14A36; font-size:13px; display:none; margin-top:10px;"></p>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Nom</th><th>Email</th><th>Rôle</th></tr>
          </thead>
          <tbody>
            ${utilisateurs
              .map(
                (u) => `<tr>
                  <td><strong>${u.nom}</strong></td>
                  <td class="mono">${u.email}</td>
                  <td>${badge(LABELS_ROLE[u.role] || u.role, 'badge-vert')}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`;

    document.getElementById('btn-nouvel-utilisateur').addEventListener('click', () => {
      document.getElementById('form-utilisateur').classList.toggle('hidden');
    });

    document.getElementById('btn-enregistrer-utilisateur').addEventListener('click', async () => {
      const erreurEl = document.getElementById('ut-erreur');
      erreurEl.style.display = 'none';

      const nom = document.getElementById('ut-nom').value.trim();
      const email = document.getElementById('ut-email').value.trim();
      const mot_de_passe = document.getElementById('ut-mdp').value;
      const role = document.getElementById('ut-role').value;

      if (!nom || !email || !mot_de_passe) {
        erreurEl.textContent = 'Veuillez remplir tous les champs requis.';
        erreurEl.style.display = 'block';
        return;
      }

      try {
        await api('/auth/utilisateurs', {
          method: 'POST',
          body: JSON.stringify({ nom, email, mot_de_passe, role })
        });
        renderUtilisateurs();
      } catch (e) {
        erreurEl.textContent = e.message || 'Erreur lors de la création du compte';
        erreurEl.style.display = 'block';
      }
    });

  } catch (err) {
    console.error('Erreur lors du chargement des utilisateurs:', err);
    el.innerHTML = `<p style="color:#B14A36;">Impossible de charger la liste des utilisateurs.</p>`;
  }
}