/**
 * Script d'évaluation des performances de la plateforme.
 * Usage : node test-performance.js [URL_DE_BASE]
 *   - Sans argument : teste http://localhost:3001
 *   - Avec argument : teste une URL en ligne, ex.
 *     node test-performance.js https://medilink-plateforme-telemaintenance.onrender.com
 *
 * Ne nécessite aucune dépendance supplémentaire (fetch est intégré à Node.js).
 */

const BASE = process.argv[2] || 'http://localhost:3001';
const EMAIL = 'rakoto@sante.mg';
const MOT_DE_PASSE = 'demo123';

function moyenne(liste) {
  return liste.reduce((a, b) => a + b, 0) / liste.length;
}
function ecartType(liste, moy) {
  const variance = liste.reduce((a, b) => a + (b - moy) ** 2, 0) / liste.length;
  return Math.sqrt(variance);
}

async function mesurerTempsReponse(nom, url, options, repetitions = 10) {
  const temps = [];
  for (let i = 0; i < repetitions; i++) {
    const debut = Date.now();
    const res = await fetch(url, options);
    await res.json().catch(() => null);
    temps.push(Date.now() - debut);
  }
  const moy = moyenne(temps);
  console.log(
    `  ${nom.padEnd(38)} moyenne: ${moy.toFixed(0)} ms   min: ${Math.min(...temps)} ms   max: ${Math.max(...temps)} ms   écart-type: ${ecartType(temps, moy).toFixed(0)} ms`
  );
  return { nom, moyenne: moy, min: Math.min(...temps), max: Math.max(...temps) };
}

async function mesurerCharge(nom, url, options, nbSimultanees = 20) {
  const debut = Date.now();
  const resultats = await Promise.allSettled(
    Array.from({ length: nbSimultanees }, () => fetch(url, options))
  );
  const duree = Date.now() - debut;
  const reussies = resultats.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
  console.log(
    `  ${nom.padEnd(38)} ${reussies}/${nbSimultanees} requêtes réussies en ${duree} ms (${(duree / nbSimultanees).toFixed(0)} ms/requête en moyenne)`
  );
  return { nom, reussies, total: nbSimultanees, duree };
}

async function main() {
  console.log(`\n=== Évaluation des performances — cible : ${BASE} ===\n`);

  console.log('Connexion...');
  const debutLogin = Date.now();
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, mot_de_passe: MOT_DE_PASSE }),
  });
  const dureeLogin = Date.now() - debutLogin;
  if (!loginRes.ok) {
    console.error('Échec de connexion — vérifiez que le serveur tourne et que les identifiants de démo existent.');
    process.exit(1);
  }
  const { token } = await loginRes.json();
  console.log(`Connexion réussie en ${dureeLogin} ms\n`);

  const headersAuth = { Authorization: `Bearer ${token}` };

  console.log('--- Temps de réponse (10 requêtes séquentielles par route) ---');
  const resultatsTemps = [];
  resultatsTemps.push(await mesurerTempsReponse('GET /api/dashboard', `${BASE}/api/dashboard`, { headers: headersAuth }));
  resultatsTemps.push(await mesurerTempsReponse('GET /api/equipements', `${BASE}/api/equipements`, { headers: headersAuth }));
  resultatsTemps.push(await mesurerTempsReponse('GET /api/incidents', `${BASE}/api/incidents`, { headers: headersAuth }));
  resultatsTemps.push(await mesurerTempsReponse('GET /api/connaissances', `${BASE}/api/connaissances`, { headers: headersAuth }));

  console.log('\n--- Comportement sous charge (20 requêtes simultanées) ---');
  const resultatsCharge = [];
  resultatsCharge.push(await mesurerCharge('20x GET /api/equipements en parallèle', `${BASE}/api/equipements`, { headers: headersAuth }, 20));
  resultatsCharge.push(await mesurerCharge('20x GET /api/dashboard en parallèle', `${BASE}/api/dashboard`, { headers: headersAuth }, 20));

  console.log('\n--- Sécurité : rejet des requêtes non authentifiées ---');
  const sansToken = await fetch(`${BASE}/api/equipements`);
  console.log(`  GET /api/equipements sans token          statut: ${sansToken.status} (attendu: 401) → ${sansToken.status === 401 ? 'OK' : 'ÉCHEC'}`);

  console.log('\n=== Résumé ===');
  console.log('Copiez ce tableau dans le mémoire, section "Évaluation des performances" :\n');
  console.log('| Route | Temps moyen | Min | Max |');
  console.log('|---|---|---|---|');
  resultatsTemps.forEach((r) => console.log(`| ${r.nom} | ${r.moyenne.toFixed(0)} ms | ${r.min} ms | ${r.max} ms |`));
  console.log('');
  resultatsCharge.forEach((r) =>
    console.log(`- ${r.nom} : ${r.reussies}/${r.total} réussies en ${r.duree} ms`)
  );
}

main().catch((err) => {
  console.error('Erreur lors du test :', err.message);
  process.exit(1);
});
