// Clears an admin's second factor, after a lost or replaced phone. Only from the server, on purpose:
// at the next visit to the admin area, the account sets up a new authenticator app.
//   node --env-file=.env scripts/reset-mfa.mjs leboss@exemple.ci
import pg from "pg";

const [contact] = process.argv.slice(2);
if (!contact) {
  console.error("Usage : node --env-file=.env scripts/reset-mfa.mjs <téléphone ou e-mail>");
  process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const { rows } = await db.query(`select id from "user" where "phoneNumber" = $1 or email = $1`, [contact]);
if (rows.length) {
  const userId = rows[0].id;
  await db.query(`delete from admin_mfa where "userId" = $1`, [userId]);
  // Sessions already verified with the old phone must verify again.
  await db.query(`update session set "mfaVerifiedAt" = null where "userId" = $1`, [userId]);
  await db.query(`insert into audit_log (id, action, target) values ($1, 'mfa.reset', $2)`, [crypto.randomUUID(), contact]);
}
await db.end();
console.log(rows.length ? `Double vérification réinitialisée pour ${contact}.` : `Aucun compte pour ${contact}.`);
process.exit(rows.length ? 0 : 1);
