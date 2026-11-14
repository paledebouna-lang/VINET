import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/mail";

/** Search engines read the listings; accounts, messages, admin and private files stay out of their reach. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/compte",
        "/connexion",
        "/comparer",
        "/documents/",
        "/favoris",
        "/locations",
        "/mes-annonces",
        "/messages",
        "/suivi",
        "/v/",
        "/vehicules",
        "/vendre",
        "/annonces/*/modifier",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
