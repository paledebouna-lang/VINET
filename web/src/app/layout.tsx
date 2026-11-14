import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource-variable/inter";
import "@fontsource-variable/sora";
import "./globals.css";
import { siteUrl } from "@/lib/mail";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MonAuto — Achat, vente et location de voitures à Abidjan",
    // Every page names itself first, then the site.
    template: "%s — MonAuto",
  },
  description:
    "Achetez, louez et vendez des voitures, motos, utilitaires et pièces détachées à Abidjan et en Côte d'Ivoire, avec vendeurs vérifiés et passeport numérique AVS.",
  openGraph: { siteName: "MonAuto", locale: "fr_CI", type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </span>
              MonAuto
            </Link>
            <nav aria-label="Navigation principale" className="site-nav">
              <Link href="/annonces?type=SALE">Acheter</Link>
              <Link href="/annonces?type=RENT">Louer</Link>
              <Link href="/annonces?categorie=PIECE">Pièces</Link>
              <Link href="/vendre">Publier</Link>
              <Link href="/favoris">Favoris</Link>
              <Link href="/messages">Messages</Link>
              <Link href="/compte" className="btn btn-outline">
                Mon compte
              </Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            <span>monauto.org</span>
            <Link href="/aide">Aide et assistance</Link>
            <span>Sécurité AVS · Réseau VINET</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
