const API = 'https://plateforme-telemaintenance-biomedicale.onrender.com/api';
const BACKEND_BASE = API.replace('/api', '');

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
              .map((u) => `
                <tr>
                  <td><strong>${u.nom}</strong></td>
                  <td class="mono">${u.email}</td>
                  <td>${badge(LABELS_ROLE[u.role] || u.role, 'badge-vert')}</td>
                </tr>
              `)
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    // Événement pour afficher/masquer le formulaire
    document.getElementById('btn-nouvel-utilisateur').addEventListener('click', () => {
      document.getElementById('form-utilisateur').classList.toggle('hidden');
    });

    // Événement pour soumettre le nouveau compte
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
          body: JSON.stringify({ nom, email, mot_de_passe, role }),
        });
        
        // Rafraîchit la liste des utilisateurs après création
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