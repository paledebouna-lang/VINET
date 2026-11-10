import { defineConfig } from "prisma/config";

// Locally DATABASE_URL lives in .env; CI and hosting inject it, so a missing file is fine.
try {
  process.loadEnvFile();
} catch {}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
