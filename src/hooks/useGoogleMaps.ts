/**
 * useGoogleMaps.ts
 *
 * Shared hook that loads the Google Maps JS SDK once per page session.
 * Previously duplicated inline in register.tsx, ngo.explore.tsx, and
 * ngo.donations.$id.tsx — those files now import from here.
 *
 * The `library` param controls which Maps library to request:
 *  - "places"  -> for the address autocomplete widget (register.tsx)
 *  - "routes"  -> for the RouteMatrix distance calculation (explore / donation-detail)
 */

import { useEffect, useState } from "react";

type MapsLibrary = "places" | "routes";

function checkReady(library: MapsLibrary): boolean {
  if (typeof window === "undefined") return false;
  const maps = (window as any).google?.maps;
  if (library === "places") return Boolean(maps?.places);
  return Boolean(maps?.routes);
}

export function useGoogleMaps(library: MapsLibrary = "routes"): boolean {
  const [ready, setReady] = useState(() => checkReady(library));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as any;

    // Already loaded
    if (checkReady(library)) {
      setReady(true);
      return;
    }

    // Register our callback
    if (!win._mapsReadyCallbacks) {
      win._mapsReadyCallbacks = [];
    }
    win._mapsReadyCallbacks.push(() => {
      if (checkReady(library)) setReady(true);
    });

    // Set up the global callback that the script tag will invoke
    win.initGoogleMaps = () => {
      if (win._mapsReadyCallbacks) {
        (win._mapsReadyCallbacks as Array<() => void>).forEach((cb) => cb());
      }
    };

    // If the script tag already exists (another instance loaded it),
    // just listen for its load event and bail early.
    const existing = document.getElementById("google-maps-script") as HTMLScriptElement | null;
    if (existing) {
      const handleLoad = () => {
        if (checkReady(library)) setReady(true);
      };
      existing.addEventListener("load", handleLoad);
      return () => existing.removeEventListener("load", handleLoad);
    }

    // Inject the script once, requesting both libraries so a single tag
    // satisfies all consumers regardless of mount order.
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = [
      "https://maps.googleapis.com/maps/api/js",
      `?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`,
      "&libraries=places,routes,marker,geometry",
      "&callback=initGoogleMaps",
      "&loading=async",
    ].join("");
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, [library]);

  return ready;
}
