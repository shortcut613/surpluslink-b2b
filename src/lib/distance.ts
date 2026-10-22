export { useGoogleMaps } from "@/hooks/useGoogleMaps";

// Computes driving distance from one origin address to many destination
// addresses in a single batched call via the Routes API.
export async function getBatchDrivingDistances(
  origin: string,
  destinations: string[],
): Promise<string[]> {
  const globalWin = window as any;
  if (!globalWin.google?.maps?.routes || !origin || destinations.length === 0) {
    return destinations.map(() => "Distance unavailable");
  }

  const validDestinations = destinations.map((d) => {
    if (d.trim() === "") return "Unknown Location";
    return d.toLowerCase().includes("south africa") ? d : `${d}, South Africa`;
  });
  const zaOrigin = origin.toLowerCase().includes("south africa")
    ? origin
    : `${origin}, South Africa`;

  try {
    const request = {
      origins: [zaOrigin],
      destinations: validDestinations,
      travelMode: "DRIVING",
      fields: ["distanceMeters", "condition"],
    };

    const response = await globalWin.google.maps.routes.RouteMatrix.computeRouteMatrix(request);

    const matrixItems = response?.matrix?.rows?.[0]?.items || response?.[0]?.elements;

    if (Array.isArray(matrixItems)) {
      return matrixItems.map((element: any) => {
        if (element && (element.condition === "ROUTE_EXISTS" || !element.status)) {
          const meters = element.distanceMeters;
          if (typeof meters === "number") {
            return `${(meters / 1000).toFixed(1)} km away`;
          }
        }
        return "Distance unknown";
      });
    }

    console.error(
      "Route Matrix execution did not produce an array structure inside output container:",
      response,
    );
    return destinations.map(() => "Distance error");
  } catch (e) {
    console.error("Failed executing modern route matrix operation:", e);
    return destinations.map(() => "Distance error");
  }
}

// Parses a leading number (in km) out of a distance string like "1.9 km away"
// for sorting purposes. Unresolved/errored distances sort to the end.
export function parseDistance(dist: string | undefined) {
  if (
    !dist ||
    dist.includes("error") ||
    dist.includes("unknown") ||
    dist.includes("unavailable") ||
    dist.includes("Calculating")
  ) {
    return Infinity;
  }
  const match = dist.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : Infinity;
}
