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