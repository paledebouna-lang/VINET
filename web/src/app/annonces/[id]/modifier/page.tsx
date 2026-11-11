import { notFound } from "next/navigation";
import { ListingForm } from "../../../vendre/listing-form";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const instant = false;

export default async function Modifier({ params }: PageProps<"/annonces/[id]/modifier">) {
  const { id } = await params;
  const user = await requireUser();
  const listing = await prisma.listing.findFirst({
    where: { id, sellerId: user.id },
    include: { photos: { orderBy: { position: "asc" } }, documents: { where: { kind: "INSURANCE" } } },
  });
  if (!listing) notFound();
  const vehicles = await prisma.vehicle.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" } });

  const { category, brand, model, year, mileageKm, fuel, transmission, priceFcfa, commune, description, vin } = listing;
  const { partName, partCondition, partReference } = listing;
  return (
    <div className="section wrap medium">
      <h1 className="page-title">Modifier mon annonce</h1>
      <ListingForm
        passports={vehicles.map((v) => ({ id: v.id, label: `${v.brand} ${v.model} ${v.year} · ${v.avsId}` }))}
        existing={{
          id,
          photoIds: listing.photos.map((p) => p.id),
          hasInsurance: listing.documents.length > 0,
          values: {
            kind: listing.kind,
            vehicleId: listing.vehicleId ?? "",
            depositFcfa: listing.depositFcfa?.toString() ?? "",
            kmPerDay: listing.kmPerDay?.toString() ?? "",
            zone: listing.zone ?? "",
            gpsModel: listing.gpsModel ?? "",
            gpsSerial: listing.gpsSerial ?? "",
            category,
            brand,
            model,
            year: year?.toString() ?? "",
            mileageKm: mileageKm?.toString() ?? "",
            fuel: fuel ?? "",
            transmission: transmission ?? "",
            partName: partName ?? "",
            partCondition: partCondition ?? "",
            partReference: partReference ?? "",
            priceFcfa: String(priceFcfa),
            commune,
            description,
            vin: vin ?? "",
          },
        }}
      />
    </div>
  );
}
