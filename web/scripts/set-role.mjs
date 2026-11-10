// Gives an existing account a role. Roles cannot be changed from the site on purpose.
//   node --env-file=.env scripts/set-role.mjs +2250708091011 admin
import pg from "pg";

const [contact, role] = process.argv.slice(2);
if (!contact || !["particulier", "agence", "admin"].includes(role)) {
  console.error("Usage : node --env-file=.env scripts/set-role.mjs <téléphone ou e-mail> <particulier|agence|admin>");
  process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const { rowCount } = await db.query(
  `update "user" set role = $2 where "phoneNumber" = $1 or email = $1`,
  [contact, role],
);
await db.query(`insert into audit_log (id, action, target) values ($1, $2, $3)`, [
  crypto.randomUUID(),
  `role.set.${role}`,
  contact,
]);
await db.end();
console.log(rowCount ? `${contact} est maintenant « ${role} ».` : `Aucun compte pour ${contact}.`);
process.exit(rowCount ? 0 : 1);
