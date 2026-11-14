import { ImageResponse } from "next/og";

// The preview shown when the site is shared (WhatsApp, Facebook…). A listing shows its own photo instead.
export const alt = "MonAuto — achat, vente et location de véhicules à Abidjan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#0B1437", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 96, height: 96, borderRadius: 24, background: "#F6B21B", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#0B1437" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div style={{ fontSize: 72, fontWeight: 700 }}>MonAuto</div>
        </div>
        <div style={{ fontSize: 48, marginTop: 48, lineHeight: 1.25 }}>Achetez, louez, vendez votre véhicule à Abidjan.</div>
        <div style={{ fontSize: 32, marginTop: 24, color: "#F6B21B" }}>Vendeurs vérifiés · Passeport numérique AVS</div>
      </div>
    ),
    size,
  );
}
