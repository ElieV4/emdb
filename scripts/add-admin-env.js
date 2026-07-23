const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
let env = fs.readFileSync(envPath, 'utf8');

if (!env.includes('ADMIN_EMAILS')) {
  env += `
# ------------------------------------------------------------
# ADMIN (Phase 6.2)
# ------------------------------------------------------------
# Liste des emails administrateurs (séparés par des virgules)
# Utilis\u00e9 par AdminGuard pour restreindre les endpoints admin.
ADMIN_EMAILS=admin@emdb.app
`;
  fs.writeFileSync(envPath, env);
  console.log('ADMIN_EMAILS added to .env');
} else {
  console.log('ADMIN_EMAILS already in .env');
}

