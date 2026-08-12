const API = 'https://medilink-plateforme-telemaintenance.onrender.com/api';
const BACKEND_BASE = API.replace('/api', '');

let utilisateurCourant = null;
let tokenCourant = null;
let cacheEquipements = [];
let cacheIncidents = [];
let cacheEtablissements = [];
let vueActive = 'dashboard';
let socket = null;

const LABELS_ROLE = {
  personnel_medical: 'Personnel médical',
  technicien_local: 'Technicien local',
  expert_distant: 'Expert distant',
  responsable_hospitalier: 'Responsable hospitalier',
  administrateur: 'Administrateur',
};

const LABELS_STATUT_EQUIPEMENT = {
  operationnel: ['Opérationnel', 'badge-vert'],
  en_panne: ['En panne', 'badge-corail'],
  en_maintenance: ['En maintenance', 'badge-ambre'],
  hors_service: ['Hors service', 'badge-gris'],
};

const LABELS_STATUT_INCIDENT = {
  ouvert: ['Ouvert', 'badge-corail'],
  en_diagnostic: ['En diagnostic', 'badge-ambre'],
  en_intervention: ['En intervention', 'badge-ambre'],
  resolu: ['Résolu', 'badge-vert'],
};

const LABELS_STATUT_INTERVENTION = {
  planifiee: ['Planifiée', 'badge-gris'],
  en_cours: ['En cours', 'badge-ambre'],
  terminee: ['Terminée', 'badge-vert'],
  validee: ['Validée', 'badge-vert'],
};

const LABELS_GRAVITE = {
  faible: ['Faible', 'badge-gris'],
  moyenne: ['Moyenne', 'badge-ambre'],
  critique: ['Critique', 'badge-corail'],
};

function badge(label, cls) {
  return `<span class="badge ${cls}">${label}</span>`;
}

async function api(path, options = {}) {
  const estFormData = options.body instanceof FormData;
  const res = await fetch(`${API}${path}`, {
    headers: {
      ...(estFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(tokenCourant ? { Authorization: `Bearer ${tokenCourant}` } : {}),
    },
    ...options,
  });
  if (res.status === 401) {
    // Token absent, invalide ou expiré : retour à l'écran de connexion
    utilisateurCourant = null;
    tokenCourant = null;
    localStorage.removeItem('madagascar_token');
    localStorage.removeItem('madagascar_utilisateur');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('ecran-login').classList.remove('hidden');
    throw new Error('Session expirée, merci de vous reconnecter');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.erreur || 'Erreur réseau');
  }
  return res.status === 204 ? null : res.json();
}

// ---------- Connexion ----------
function afficherErreurLogin(message) {
  const el = document.getElementById('login-erreur');
  el.textContent = message;
  el.style.display = 'block';
}

async function entrerDansApp(utilisateur, token) {
  utilisateurCourant = utilisateur;
  tokenCourant = token;
  localStorage.setItem('madagascar_token', token);
  localStorage.setItem('madagascar_utilisateur', JSON.stringify(utilisateur));
  document.getElementById('user-nom').textContent = utilisateur.nom;
  document.getElementById('user-role').textContent = LABELS_ROLE[utilisateur.role];
  document.getElementById('nav-utilisateurs').classList.toggle('hidden', utilisateur.role !== 'administrateur');
  document.getElementById('ecran-login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  chargerVue('dashboard');
  connecterNotificationsTempsReel();
}

function afficherToast(titre, message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<strong>${titre}</strong>${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

function connecterNotificationsTempsReel() {
  if (socket) return; // déjà connecté
  socket = io(BACKEND_BASE);

  socket.on('incident:nouveau', (incident) => {
    afficherToast('Nouvel incident', `${incident.equipement_nom} — signalé par ${incident.signale_par}`);
    if (vueActive === 'incidents' || vueActive === 'dashboard') chargerVue(vueActive);
  });

  socket.on('incident:message', (msg) => {
    afficherToast('Diagnostic à distance', `${msg.auteur} : ${msg.contenu}`);
    if (vueActive === 'incidents') chargerVue(vueActive);
  });

  socket.on('intervention:nouvelle', () => {
    afficherToast('Intervention planifiée', "Une nouvelle intervention vient d'être planifiée");
    if (vueActive === 'interventions' || vueActive === 'dashboard') chargerVue(vueActive);
  });

  socket.on('intervention:maj', (info) => {
    afficherToast('Intervention mise à jour', `Statut : ${LABELS_STATUT_INTERVENTION[info.statut]?.[0] || info.statut}`);
    if (vueActive === 'interventions' || vueActive === 'dashboard') chargerVue(vueActive);
  });
}

document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const mot_de_passe = document.getElementById('login-mdp').value;
  document.getElementById('login-erreur').style.display = 'none';

  try {
    const { token, utilisateur } = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, mot_de_passe }),
    });
    entrerDansApp(utilisateur, token);
  } catch (e) {
    afficherErreurLogin('Email ou mot de passe incorrect.');
  }
});

document.getElementById('btn-logout').addEventListener('click', () => {
  utilisateurCourant = null;
  tokenCourant = null;
  localStorage.removeItem('madagascar_token');
  localStorage.removeItem('madagascar_utilisateur');
  if (socket) { socket.disconnect(); socket = null; }
  document.getElementById('app').classList.add('hidden');
  document.getElementById('ecran-login').classList.remove('hidden');
});

// Reconnexion automatique si un token valide est déjà en mémoire locale
(function reprendreSession() {
  const token = localStorage.getItem('madagascar_token');
  const utilisateur = localStorage.getItem('madagascar_utilisateur');
  if (token && utilisateur) {
    tokenCourant = token;
    entrerDansApp(JSON.parse(utilisateur), token);
  }
})();

// ---------- Navigation ----------
document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    chargerVue(btn.dataset.vue);
  });
});

function afficherVue(nom) {
  document.querySelectorAll('.vue').forEach((v) => v.classList.add('hidden'));
  document.getElementById(`vue-${nom}`).classList.remove('hidden');
}

async function chargerVue(nom) {
  vueActive = nom;
  afficherVue(nom);
  if (nom === 'dashboard') return renderDashboard();
  if (nom === 'equipements') return renderEquipements();
  if (nom === 'incidents') return renderIncidents();
  if (nom === 'interventions') return renderInterventions();
  if (nom === 'connaissances') return renderConnaissances();
  if (nom === 'utilisateurs') return renderUtilisateurs();
}

// ---------- Tableau de bord ----------
async function renderDashboard() {
  const el = document.getElementById('vue-dashboard');
  const stats = await api('/dashboard');
  el.innerHTML = `
    <h1>Tableau de bord</h1>
    <p class="sous-titre">Vue d'ensemble du parc d'équipements et des interventions en cours.</p>
    <div class="cartes-indicateurs">
      <div class="carte-indicateur">
        <div class="valeur">${stats.totalEquipements}</div>
        <div class="label">Équipements suivis</div>
      </div>
      <div class="carte-indicateur alerte">
        <div class="valeur">${stats.equipementsEnPanne}</div>
        <div class="label">Équipements en panne</div>
      </div>
      <div class="carte-indicateur alerte">
        <div class="valeur">${stats.incidentsOuverts}</div>
        <div class="label">Incidents ouverts</div>
      </div>
      <div class="carte-indicateur">
        <div class="valeur">${stats.interventionsEnCours}</div>
        <div class="label">Interventions en cours</div>
      </div>
    </div>
  `;
}

// ---------- Équipements ----------
async function renderEquipements() {
  const el = document.getElementById('vue-equipements');
  cacheEquipements = await api('/equipements');
  cacheEtablissements = await api('/equipements/etablissements');

  el.innerHTML = `
    <div class="entete-vue">
      <div>
        <h1>Équipements</h1>
        <p class="sous-titre">Inventaire et statut des équipements biomédicaux, répartis sur ${cacheEtablissements.length} établissements de santé.</p>
      </div>
      <button class="btn-secondaire" id="btn-nouvel-equipement">+ Nouvel équipement</button>
    </div>
    <div class="panneau-form hidden" id="form-equipement">
      <div><label>Établissement</label>
        <select id="eq-etablissement">${cacheEtablissements.map((e) => `<option value="${e.id}">${e.nom}</option>`).join('')}</select>
      </div>
      <div><label>Type</label><input id="eq-type" placeholder="Ex. Échographe portable"></div>
      <div><label>Nom / désignation</label><input id="eq-nom"></div>
      <div><label>Numéro de série</label><input id="eq-serie"></div>
      <div><label>Date d'acquisition</label><input id="eq-date" type="date"></div>
      <div class="pleine-largeur"><button class="btn-primary" id="btn-enregistrer-equipement">Enregistrer</button></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Équipement</th><th>Établissement</th><th>N° série</th><th>Statut</th></tr></thead>
        <tbody>
          ${cacheEquipements
            .map((e) => {
              const [label, cls] = LABELS_STATUT_EQUIPEMENT[e.statut];
              return `<tr><td><strong>${e.nom}</strong><br><span class="mono">${e.type}</span></td><td>${e.etablissement_nom}</td><td class="mono">${e.numero_serie}</td><td>${badge(label, cls)}</td></tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-nouvel-equipement').addEventListener('click', () => {
    document.getElementById('form-equipement').classList.toggle('hidden');
  });
  document.getElementById('btn-enregistrer-equipement').addEventListener('click', async () => {
    await api('/equipements', {
      method: 'POST',
      body: JSON.stringify({
        etablissement_id: document.getElementById('eq-etablissement').value,
        type: document.getElementById('eq-type').value,
        nom: document.getElementById('eq-nom').value,
        numero_serie: document.getElementById('eq-serie').value,
        date_acquisition: document.getElementById('eq-date').value,
      }),
    });
    renderEquipements();
  });
}

// ---------- Incidents ----------
async function renderIncidents() {
  const el = document.getElementById('vue-incidents');
  cacheIncidents = await api('/incidents');
  if (!cacheEquipements.length) cacheEquipements = await api('/equipements');

  el.innerHTML = `
    <div class="entete-vue">
      <div>
        <h1>Incidents</h1>
        <p class="sous-titre">Signalement et suivi des pannes, avec fil de diagnostic à distance.</p>
      </div>
      <button class="btn-secondaire" id="btn-nouvel-incident">+ Signaler un incident</button>
    </div>
    <div class="panneau-form hidden" id="form-incident">
      <div><label>Équipement concerné</label>
        <select id="inc-equipement">${cacheEquipements.map((e) => `<option value="${e.id}">${e.nom}</option>`).join('')}</select>
      </div>
      <div><label>Gravité</label>
        <select id="inc-gravite"><option value="faible">Faible</option><option value="moyenne">Moyenne</option><option value="critique">Critique</option></select>
      </div>
      <div class="pleine-largeur"><label>Description</label><textarea id="inc-description" rows="2"></textarea></div>
      <div class="pleine-largeur"><button class="btn-primary" id="btn-enregistrer-incident">Signaler</button></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Équipement</th><th>Description</th><th>Gravité</th><th>Statut</th><th>Signalé par</th><th></th></tr></thead>
        <tbody>
          ${cacheIncidents
            .map((i) => {
              const [labelS, clsS] = LABELS_STATUT_INCIDENT[i.statut];
              const [labelG, clsG] = LABELS_GRAVITE[i.gravite];
              return `<tr>
                <td>${i.equipement_nom}</td>
                <td>${i.description}</td>
                <td>${badge(labelG, clsG)}</td>
                <td>${badge(labelS, clsS)}</td>
                <td>${i.signale_par}</td>
                <td><button class="action-lien" data-incident="${i.id}">Diagnostic →</button></td>
              </tr>
              <tr class="details-ligne hidden" id="details-${i.id}"><td colspan="6"></td></tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-nouvel-incident').addEventListener('click', () => {
    document.getElementById('form-incident').classList.toggle('hidden');
  });
  document.getElementById('btn-enregistrer-incident').addEventListener('click', async () => {
    await api('/incidents', {
      method: 'POST',
      body: JSON.stringify({
        equipement_id: document.getElementById('inc-equipement').value,
        utilisateur_id: utilisateurCourant.id,
        description: document.getElementById('inc-description').value,
        gravite: document.getElementById('inc-gravite').value,
      }),
    });
    renderIncidents();
  });

  document.querySelectorAll('[data-incident]').forEach((btn) => {
    btn.addEventListener('click', () => ouvrirDiagnostic(btn.dataset.incident));
  });
}

async function ouvrirDiagnostic(incidentId) {
  const ligne = document.getElementById(`details-${incidentId}`);
  const ouvert = !ligne.classList.contains('hidden');
  document.querySelectorAll('.details-ligne').forEach((l) => l.classList.add('hidden'));
  if (ouvert) return;

  const messages = await api(`/incidents/${incidentId}/messages`);
  ligne.querySelector('td').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <p style="font-size:12px; color:var(--text-muted); margin:0; font-weight:500;">Diagnostic à distance</p>
      <button class="btn-secondaire" id="visio-toggle-${incidentId}">📹 Démarrer la visioconférence</button>
    </div>
    <div id="visio-zone-${incidentId}" class="hidden" style="margin-bottom:14px;"></div>
    <div class="fil-messages">
      ${messages
        .map(
          (m) =>
            `<div class="message">
              <div class="auteur">${m.auteur} · ${LABELS_ROLE[m.auteur_role]}</div>
              ${m.contenu ? `<div>${m.contenu}</div>` : ''}
              ${m.image_url ? `<img src="${BACKEND_BASE}${m.image_url}" alt="Photo jointe" style="max-width:220px; border-radius:8px; margin-top:6px; display:block; cursor:pointer;" onclick="window.open('${BACKEND_BASE}${m.image_url}', '_blank')">` : ''}
            </div>`
        )
        .join('') || '<em class="mono">Aucun échange pour le moment.</em>'}
    </div>
    <div id="apercu-photo-${incidentId}" class="hidden" style="margin-top:10px;">
      <img id="apercu-img-${incidentId}" style="max-width:120px; border-radius:8px; display:block; margin-bottom:6px;">
      <button class="action-lien" id="retirer-photo-${incidentId}">Retirer la photo</button>
    </div>
    <div style="display:flex; gap:8px; margin-top:10px;">
      <input type="text" id="msg-input-${incidentId}" placeholder="Écrire un message de diagnostic..." style="flex:1; padding:8px 10px; border-radius:6px; border:1px solid var(--line);">
      <label class="btn-secondaire" style="cursor:pointer; display:flex; align-items:center;" title="Joindre une photo">
        📷
        <input type="file" id="msg-photo-${incidentId}" accept="image/*" style="display:none;">
      </label>
      <button class="btn-secondaire" id="msg-envoyer-${incidentId}">Envoyer</button>
    </div>
  `;
  ligne.classList.remove('hidden');

  document.getElementById(`visio-toggle-${incidentId}`).addEventListener('click', () => {
    const zone = document.getElementById(`visio-zone-${incidentId}`);
    if (!zone.classList.contains('hidden')) {
      zone.classList.add('hidden');
      zone.innerHTML = '';
      return;
    }
    const salle = `Telemaintenance-Madagascar-Incident-${incidentId}`;
    zone.innerHTML = `<iframe
      src="https://meet.jit.si/${salle}#config.prejoinPageEnabled=false&userInfo.displayName=%22${encodeURIComponent(utilisateurCourant.nom)}%22"
      style="width:100%; height:420px; border:0; border-radius:10px;"
      allow="camera; microphone; fullscreen; display-capture; autoplay"></iframe>`;
    zone.classList.remove('hidden');
  });

  const inputPhoto = document.getElementById(`msg-photo-${incidentId}`);
  const apercuZone = document.getElementById(`apercu-photo-${incidentId}`);
  const apercuImg = document.getElementById(`apercu-img-${incidentId}`);

  inputPhoto.addEventListener('change', () => {
    if (!inputPhoto.files[0]) return;
    apercuImg.src = URL.createObjectURL(inputPhoto.files[0]);
    apercuZone.classList.remove('hidden');
  });
  document.getElementById(`retirer-photo-${incidentId}`).addEventListener('click', () => {
    inputPhoto.value = '';
    apercuZone.classList.add('hidden');
  });

  document.getElementById(`msg-envoyer-${incidentId}`).addEventListener('click', async () => {
    const input = document.getElementById(`msg-input-${incidentId}`);
    const fichier = inputPhoto.files[0];
    if (!input.value.trim() && !fichier) return;

    const donnees = new FormData();
    donnees.append('utilisateur_id', utilisateurCourant.id);
    donnees.append('contenu', input.value);
    if (fichier) donnees.append('image', fichier);

    await api(`/incidents/${incidentId}/messages`, { method: 'POST', body: donnees });
    ouvrirDiagnostic(incidentId);
    renderIncidents();
  });
}

// ---------- Interventions ----------
async function renderInterventions() {
  const el = document.getElementById('vue-interventions');
  const interventions = await api('/interventions');
  if (!cacheIncidents.length) cacheIncidents = await api('/incidents');
  const utilisateurs = await api('/auth/utilisateurs');
  const techniciens = utilisateurs.filter((u) => u.role === 'technicien_local');
  const incidentsSansIntervention = cacheIncidents.filter((i) => i.statut !== 'resolu');

  el.innerHTML = `
    <div class="entete-vue">
      <div>
        <h1>Interventions</h1>
        <p class="sous-titre">Planification et clôture des interventions techniques.</p>
      </div>
      <button class="btn-secondaire" id="btn-nouvelle-intervention">+ Planifier une intervention</button>
    </div>
    <div class="panneau-form hidden" id="form-intervention">
      <div><label>Incident concerné</label>
        <select id="iv-incident">${incidentsSansIntervention.map((i) => `<option value="${i.id}">#${i.id} — ${i.equipement_nom}</option>`).join('')}</select>
      </div>
      <div><label>Technicien assigné</label>
        <select id="iv-technicien">${techniciens.map((t) => `<option value="${t.id}">${t.nom}</option>`).join('')}</select>
      </div>
      <div class="pleine-largeur"><button class="btn-primary" id="btn-enregistrer-intervention">Planifier</button></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Incident</th><th>Technicien</th><th>Statut</th><th>Rapport</th><th></th></tr></thead>
        <tbody>
          ${interventions
            .map((iv) => {
              const [label, cls] = LABELS_STATUT_INTERVENTION[iv.statut];
              return `<tr>
                <td>${iv.incident_description}</td>
                <td>${iv.technicien_nom}</td>
                <td>${badge(label, cls)}</td>
                <td>${iv.rapport ? iv.rapport : '<span class="mono">—</span>'}</td>
                <td>${
                  iv.statut !== 'validee'
                    ? `<button class="action-lien" data-clore="${iv.id}">Mettre à jour</button>`
                    : ''
                }</td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-nouvelle-intervention').addEventListener('click', () => {
    document.getElementById('form-intervention').classList.toggle('hidden');
  });
  document.getElementById('btn-enregistrer-intervention').addEventListener('click', async () => {
    await api('/interventions', {
      method: 'POST',
      body: JSON.stringify({
        incident_id: document.getElementById('iv-incident').value,
        technicien_id: document.getElementById('iv-technicien').value,
      }),
    });
    renderInterventions();
  });

  document.querySelectorAll('[data-clore]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const rapport = prompt('Rapport d\'intervention :', '');
      if (rapport === null) return;
      const statut = confirm('Valider et clôturer définitivement cette intervention ?') ? 'validee' : 'terminee';
      await api(`/interventions/${btn.dataset.clore}`, {
        method: 'PATCH',
        body: JSON.stringify({ statut, rapport }),
      });
      renderInterventions();
    });
  });
}

// ---------- Base de connaissances ----------
async function renderConnaissances() {
  const el = document.getElementById('vue-connaissances');
  const articles = await api('/connaissances');

  el.innerHTML = `
    <div class="entete-vue">
      <div>
        <h1>Base de connaissances</h1>
        <p class="sous-titre">Retours d'expérience et procédures partagées par l'équipe.</p>
      </div>
      <button class="btn-secondaire" id="btn-nouvel-article">+ Contribuer</button>
    </div>
    <div class="panneau-form hidden" id="form-article">
      <div class="pleine-largeur"><label>Titre</label><input id="art-titre"></div>
      <div class="pleine-largeur"><label>Contenu</label><textarea id="art-contenu" rows="3"></textarea></div>
      <div class="pleine-largeur"><button class="btn-primary" id="btn-enregistrer-article">Publier</button></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Titre</th><th>Contenu</th><th>Auteur</th></tr></thead>
        <tbody>
          ${articles
            .map(
              (a) =>
                `<tr><td><strong>${a.titre}</strong></td><td>${a.contenu}</td><td>${a.auteur}</td></tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-nouvel-article').addEventListener('click', () => {
    document.getElementById('form-article').classList.toggle('hidden');
  });
  document.getElementById('btn-enregistrer-article').addEventListener('click', async () => {
    await api('/connaissances', {
      method: 'POST',
      body: JSON.stringify({
        utilisateur_id: utilisateurCourant.id,
        titre: document.getElementById('art-titre').value,
        contenu: document.getElementById('art-contenu').value,
      }),
    });
    renderConnaissances();
  });
}

// ---------- Gestion des utilisateurs (réservée à l'administrateur) ----------
async function renderUtilisateurs() {
  const el = document.getElementById('vue-utilisateurs');

  if (utilisateurCourant.role !== 'administrateur') {
    el.innerHTML = `<h1>Accès réservé</h1><p class="sous-titre">Cette section est réservée à l'administrateur de la plateforme.</p>`;
    return;
  }

  const utilisateurs = await api('/auth/utilisateurs');

  el.innerHTML = `
    <div class="entete-vue">
      <div>
        <h1>Utilisateurs</h1>
        <p class="sous-titre">Gestion des comptes — seul l'administrateur peut ajouter un utilisateur.</p>
      </div>
      <button class="btn-secondaire" id="btn-nouvel-utilisateur">+ Ajouter un utilisateur</button>
    </div>
    <div class="panneau-form hidden" id="form-utilisateur">
      <div><label>Nom complet</label><input id="ut-nom"></div>
      <div><label>Email</label><input id="ut-email" type="email"></div>
      <div><label>Mot de passe</label><input id="ut-mdp" type="password"></div>
      <div><label>Rôle</label>
        <select id="ut-role">
          <option value="personnel_medical">Personnel médical</option>
          <option value="technicien_local">Technicien local</option>
          <option value="expert_distant">Expert distant</option>
          <option value="responsable_hospitalier">Responsable hospitalier</option>
          <option value="administrateur">Administrateur</option>
        </select>
      </div>
      <div class="pleine-largeur"><button class="btn-primary" id="btn-enregistrer-utilisateur">Créer le compte</button></div>
      <p id="ut-erreur" class="pleine-largeur" style="color:#B14A36; font-size:13px; display:none; margin:0;"></p>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nom</th><th>Email</th><th>Rôle</th></tr></thead>
        <tbody>
          ${utilisateurs
            .map((u) => `<tr><td><strong>${u.nom}</strong></td><td class="mono">${u.email}</td><td>${badge(LABELS_ROLE[u.role], 'badge-vert')}</td></tr>`)
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-nouvel-utilisateur').addEventListener('click', () => {
    document.getElementById('form-utilisateur').classList.toggle('hidden');
  });
  document.getElementById('btn-enregistrer-utilisateur').addEventListener('click', async () => {
    const erreurEl = document.getElementById('ut-erreur');
    erreurEl.style.display = 'none';
    try {
      await api('/auth/utilisateurs', {
        method: 'POST',
        body: JSON.stringify({
          nom: document.getElementById('ut-nom').value,
          email: document.getElementById('ut-email').value,
          mot_de_passe: document.getElementById('ut-mdp').value,
          role: document.getElementById('ut-role').value,
        }),
      });
      renderUtilisateurs();
    } catch (e) {
      erreurEl.textContent = e.message || 'Erreur lors de la création du compte';
      erreurEl.style.display = 'block';
    }
  });
}

// Rien à initialiser au chargement : reprendreSession() (ci-dessus) gère
// l'affichage de l'écran de connexion ou de l'application.
