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
    include: { photos: { orderBy: { position: "asc" } } },
  });
  if (!listing) notFound();

  const { category, brand, model, year, mileageKm, fuel, transmission, priceFcfa, commune, description, vin } = listing;
  return (
    <div className="section wrap medium">
      <h1 className="page-title">Modifier mon annonce</h1>
      <ListingForm
        existing={{
          id,
          photoIds: listing.photos.map((p) => p.id),
          values: {
            category,
            brand,
            model,
            year: String(year),
            mileageKm: String(mileageKm),
            fuel,
            transmission,
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
