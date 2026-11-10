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

## Vérifications

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Après une modification de `prisma/schema.prisma`

```bash
npx prisma migrate dev
npx prisma generate
```
