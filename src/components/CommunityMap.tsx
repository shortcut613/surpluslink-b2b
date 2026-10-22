import React, { useState, useEffect, useRef } from "react";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { supabase } from "@/lib/supabase";

// Fallback only used if we truly can't determine the donor's location
// (no stored lat/lng AND geocoding failed/unavailable).
const FALLBACK_LOCATION: [number, number] = [-26.2041, 28.0473]; // Johannesburg

// Geocodes a text address via the Google Geocoder or Google Geocoding REST API fallback.
async function geocodeAddress(address: string): Promise<[number, number] | null> {
  const gw = typeof window !== "undefined" ? (window as any) : null;
  if (gw?.google?.maps?.Geocoder) {
    return new Promise((resolve) => {
      new gw.google.maps.Geocoder().geocode(
        { address, componentRestrictions: { country: "ZA" } },
        (results: any[], status: string) => {
          if (status === "OK" && results?.[0]?.geometry?.location) {
            resolve([results[0].geometry.location.lat(), results[0].geometry.location.lng()]);
          } else {
            resolve(null);
          }
        },
      );
    });
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!address || !apiKey) return null;

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address,
      )}&components=country:ZA&key=${apiKey}`,
    );
    const data = await res.json();
    const loc = data?.results?.[0]?.geometry?.location;
    if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
      return [loc.lat, loc.lng];
    }
    console.warn(
      "[CommunityMap] Geocoding returned no usable result for donor address:",
      address,
      data,
    );
    return null;
  } catch (e) {
    console.error("[CommunityMap] Geocoding request failed:", e);
    return null;
  }
}

interface CommunityMapProps {
  loggedInDonorId: string;
  donorAddress?: string;
}

export default function CommunityMap({ loggedInDonorId, donorAddress }: CommunityMapProps) {
  const mapsReady = useGoogleMaps("routes");
  const [networkData, setNetworkData] = useState<any[]>([]);
  const [donorLocation, setDonorLocation] = useState<[number, number] | null>(null);
  const [donorLocationLoading, setDonorLocationLoading] = useState(true);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  // 1. Fetch community network entries for this donor
  useEffect(() => {
    async function fetchData() {
      if (!loggedInDonorId) return;

      const { data, error } = await supabase
        .from("donor_community_network")
        .select("*")
        .eq("donor_id", loggedInDonorId);

      if (!error && data) {
        setNetworkData(data);
      } else {
        console.error("[CommunityMap] Supabase Error:", error);
      }
    }
    fetchData();
  }, [loggedInDonorId]);

  // 2. Resolve donor's coordinates
  useEffect(() => {
    async function resolveDonorLocation() {
      if (!loggedInDonorId) return;
      setDonorLocationLoading(true);

      const { data: donorRow, error } = await supabase
        .from("donors")
        .select("address, address_components")
        .eq("id", loggedInDonorId)
        .maybeSingle();

      if (error) {
        console.error("[CommunityMap] Failed to fetch donor location:", error);
        setDonorLocation(FALLBACK_LOCATION);
        setDonorLocationLoading(false);
        return;
      }

      // Prefer stored coordinates from registration
      const storedLat = donorRow?.address_components?.lat;
      const storedLng = donorRow?.address_components?.lng;
      if (typeof storedLat === "number" && typeof storedLng === "number") {
        setDonorLocation([storedLat, storedLng]);
        setDonorLocationLoading(false);
        return;
      }

      // Fall back to geocoding the stored text address
      const addressToGeocode = donorRow?.address || donorAddress;
      const geocoded = addressToGeocode ? await geocodeAddress(addressToGeocode) : null;
      setDonorLocation(geocoded ?? FALLBACK_LOCATION);
      setDonorLocationLoading(false);
    }

    resolveDonorLocation();
  }, [loggedInDonorId, donorAddress]);

  // Filter valid NGOs with coordinates
  const validNgos = networkData.filter((ngo) => {
    const lat = Number(ngo.ngo_latitude);
    const lng = Number(ngo.ngo_longitude);
    return (
      ngo.ngo_latitude !== null &&
      ngo.ngo_longitude !== null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    );
  });

  // 3. Initialize Google Maps and render Hub, NGOs, and dashed connections
  useEffect(() => {
    if (!mapsReady || !mapRef.current || !donorLocation) return;
    const gw = window as any;
    if (!gw.google?.maps) return;

    // Clear previous map instance container children
    mapRef.current.innerHTML = "";

    const map = new gw.google.maps.Map(mapRef.current, {
      center: { lat: donorLocation[0], lng: donorLocation[1] },
      zoom: 11,
      mapId: "COMMUNITY_MAP_ID",
      mapTypeControl: false,
      fullscreenControl: true,
      streetViewControl: false,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    // Donor Hub Pin element (dark slate house badge)
    const donorPin = document.createElement("div");
    donorPin.innerHTML = `
      <div style="background-color: #0f172a; color: white; border: 2.5px solid white; border-radius: 50%; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.3); cursor: pointer;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
    `;

    const AdvancedMarker = gw.google.maps.marker?.AdvancedMarkerElement;

    const hubMarker = AdvancedMarker
      ? new AdvancedMarker({
          position: { lat: donorLocation[0], lng: donorLocation[1] },
          map,
          title: "Your Hub",
          content: donorPin,
          zIndex: 1000,
        })
      : new gw.google.maps.Marker({
          position: { lat: donorLocation[0], lng: donorLocation[1] },
          map,
          title: "Your Hub",
        });

    const hubInfoWindow = new gw.google.maps.InfoWindow({
      content: `<div style="font-weight:600;padding:4px 8px;font-family:sans-serif;color:#0f172a;">Your Hub</div>`,
    });

    hubMarker.addListener("click", () => {
      hubInfoWindow.open({ anchor: hubMarker, map });
    });

    const bounds = new gw.google.maps.LatLngBounds();
    bounds.extend({ lat: donorLocation[0], lng: donorLocation[1] });

    // Dashed emerald line symbol
    const lineSymbol = {
      path: "M 0,-1 0,1",
      strokeOpacity: 1,
      scale: 3,
      strokeColor: "#10b981",
    };

    // Render each NGO marker and connection line
    validNgos.forEach((ngo) => {
      let ngoLat = Number(ngo.ngo_latitude);
      let ngoLng = Number(ngo.ngo_longitude);

      // If the NGO and Donor are at the exact same coordinates,
      // add a tiny offset (~15 meters) so both markers are visible
      if (
        Math.abs(ngoLat - donorLocation[0]) < 0.0001 &&
        Math.abs(ngoLng - donorLocation[1]) < 0.0001
      ) {
        ngoLat += 0.00015;
        ngoLng += 0.00015;
      }

      const ngoPos = { lat: ngoLat, lng: ngoLng };
      bounds.extend(ngoPos);

      // Emerald green pin badge for NGO
      const ngoPin = document.createElement("div");
      ngoPin.innerHTML = `
        <div style="background-color: #10b981; color: white; border: 2px solid white; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 6px rgba(0,0,0,0.25); cursor: pointer;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      `;

      const ngoMarker = AdvancedMarker
        ? new AdvancedMarker({
            position: ngoPos,
            map,
            title: ngo.ngo_name || "Community Partner",
            content: ngoPin,
            zIndex: 500,
          })
        : new gw.google.maps.Marker({
            position: ngoPos,
            map,
            title: ngo.ngo_name || "Community Partner",
          });

      const infoWindow = new gw.google.maps.InfoWindow({
        content: `<div style="font-weight:600;padding:4px 8px;font-family:sans-serif;color:#0f172a;">${
          ngo.ngo_name || "Community Partner"
        }</div>`,
      });

      ngoMarker.addListener("click", () => {
        infoWindow.open({ anchor: ngoMarker, map });
      });

      // Dashed emerald connection line
      new gw.google.maps.Polyline({
        path: [{ lat: donorLocation[0], lng: donorLocation[1] }, ngoPos],
        strokeOpacity: 0,
        geodesic: true,
        icons: [
          {
            icon: lineSymbol,
            offset: "0",
            repeat: "15px",
          },
        ],
        map,
      });
    });

    if (validNgos.length > 0) {
      map.fitBounds(bounds, 50);
    }
  }, [mapsReady, donorLocation, validNgos.length]);

  if (donorLocationLoading || !donorLocation) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        Locating your hub…
      </div>
    );
  }

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden relative">
      {!mapsReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60 backdrop-blur-sm text-sm text-muted-foreground">
          Loading Google Maps…
        </div>
      )}
      <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}
