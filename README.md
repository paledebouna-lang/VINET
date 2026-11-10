# MonAuto

Marketplace d'achat, de vente et de location de véhicules, avec la sécurité AVS et le réseau de détection VINET.

- `docs/FEUILLE_DE_ROUTE.md` — ordre des lots, décisions prises et à prendre.
- `web/` — le site et son API (Next.js, PostgreSQL via Prisma, connexion par code avec better-auth).

## Lancer le site en local

Il faut Node 22 et un PostgreSQL accessible.

```bash
cd web
cp .env.example .env
```

Renseignez `DATABASE_URL` et `BETTER_AUTH_SECRET` dans `.env`, puis :

```bash
npm install
npx prisma migrate deploy
npm run dev
```

En développement, les codes de connexion s'affichent dans le terminal du serveur. Les codes par e-mail partent réellement dès que `SMTP_URL` est renseigné.

Les photos des annonces sont enregistrées dans `web/uploads`, ou dans le dossier indiqué par `UPLOAD_DIR`.

## Donner le rôle d'administrateur

La personne se connecte une première fois sur le site, puis :

```bash
node --env-file=.env scripts/set-role.mjs +2250708091011 admin
```

La modération se trouve ensuite sur `/admin`.

## Balises GPS

Une balise déclarée sur le passeport d'un véhicule reçoit une clé, affichée une seule fois. La balise, ou la passerelle qui traduit son protocole, envoie ses positions ainsi :

```http
POST /api/trackers/positions
Authorization: Bearer <clé de la balise>
Content-Type: application/json

{"positions": [{"time": "2026-11-10T12:00:00Z", "lat": 5.3237, "lng": -4.0167, "accuracy": 8, "speed": 42, "powerCut": false}]}
```

`time` est l'heure de la mesure (ISO 8601), `accuracy` en mètres, `speed` en km/h ; ces trois derniers champs sont facultatifs. Jusqu'à 500 positions par envoi. Une position déjà reçue est ignorée. Réponses : 200 avec le nombre de positions enregistrées, 400 si le contenu est invalide, 401 si la clé est inconnue.

## Vérifications

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Après une modification de `prisma/schema.prisma`

```bash
npx prisma migrate dev
npx prisma generate
```
