/**
 * useDeliveryMap.ts
 *
 * React hook that owns the full Google Maps lifecycle for the delivery
 * tracking page using modern Google Maps APIs (Routes API & Advanced Markers):
 *   1. Waits for the Maps JS SDK via polling readiness check
 *   2. Instantiates the Map canvas immediately to avoid blank renders
 *   3. Geocodes originAddress (donor) and destAddress (NGO) to real LatLng
 *   4. Fetches road route via google.maps.routes.Route.computeRoutes (with straight-line fallback)
 *   5. Formats distances in km and durations in hrs / mins
 *   6. Renders embedded map with Advanced Marker elements
 *   7. Smoothly animates courier position along the route
 */

import { RefObject, useEffect, useRef, useState } from "react";
import { getDeliveryProgress } from "@/lib/delivery-sim";

// ── Duration Formatter (Converts minutes to "X hr Y mins") ─────────────────
function formatDuration(totalMinutes: number): string {
  const mins = Math.round(totalMinutes);
  if (mins < 1) return "< 1 min";

  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;

  if (hours === 0) {
    return `${remainingMins} min${remainingMins === 1 ? "" : "s"}`;
  }
  if (remainingMins === 0) {
    return `${hours} hr${hours === 1 ? "" : "s"}`;
  }
  return `${hours} hr${hours === 1 ? "" : "s"} ${remainingMins} min${remainingMins === 1 ? "" : "s"}`;
}

// ── Internal Maps SDK readiness hook ──────────────────────────────────────
function useGoogleMapsCore(): boolean {
  const [ready, setReady] = useState<boolean>(
    () => typeof window !== "undefined" && !!(window as any).google?.maps,
  );

  useEffect(() => {
    const gw = window as any;

    if (gw.google?.maps?.routes && gw.google?.maps?.marker) {
      setReady(true);
      return;
    }

    gw.initGoogleMaps = gw.initGoogleMaps || function () {};

    const SCRIPT_ID = "google-maps-script";
    if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.src = `https://maps.googleapis.com/maps/api/js?key=${
        import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      }&loading=async&libraries=routes,marker,geometry`;
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }

    const timer = setInterval(() => {
      const g = (window as any).google;
      if (g?.maps?.routes && g?.maps?.marker && g?.maps?.geometry) {
        clearInterval(timer);
        setReady(true);
      }
    }, 200);

    return () => clearInterval(timer);
  }, []);

  return ready;
}

// ── Types ──────────────────────────────────────────────────────────────────
export interface DeliveryMapResult {
  routeReady: boolean;
  distanceText: string;
  durationText: string;
  geocodeError: string | null;
}

// ── Path maths ─────────────────────────────────────────────────────────────
function computeDistanceBetween(p1: any, p2: any): number {
  const gw = window as any;
  if (gw.google?.maps?.geometry?.spherical?.computeDistanceBetween) {
    return gw.google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
  }
  // Fallback Haversine in meters
  const R = 6371000;
  const lat1 = (p1.lat() * Math.PI) / 180;
  const lat2 = (p2.lat() * Math.PI) / 180;
  const dLat = ((p2.lat() - p1.lat()) * Math.PI) / 180;
  const dLng = ((p2.lng() - p1.lng()) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function interpolateAlongPath(path: any[], t: number): any | null {
  const gw = window as any;
  if (!path || path.length === 0) return null;
  if (path.length === 1 || t <= 0) return path[0];
  if (t >= 1) return path[path.length - 1];

  // Constant-speed cumulative distance interpolation
  const segmentDistances: number[] = [];
  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const d = computeDistanceBetween(path[i], path[i + 1]);
    segmentDistances.push(d);
    totalDistance += d;
  }

  if (totalDistance === 0) return path[0];

  const targetDistance = t * totalDistance;
  let accumulated = 0;

  for (let i = 0; i < segmentDistances.length; i++) {
    const segDist = segmentDistances[i];
    if (accumulated + segDist >= targetDistance || i === segmentDistances.length - 1) {
      const segT =
        segDist <= 0 ? 0 : Math.min(Math.max((targetDistance - accumulated) / segDist, 0), 1);
      const lat = path[i].lat() + segT * (path[i + 1].lat() - path[i].lat());
      const lng = path[i].lng() + segT * (path[i + 1].lng() - path[i].lng());
      return new gw.google.maps.LatLng(lat, lng);
    }
    accumulated += segDist;
  }

  return path[path.length - 1];
}

// ── Geocoding helper ───────────────────────────────────────────────────────
async function geocodeAddress(address: string): Promise<any | null> {
  const gw = window as any;
  return new Promise((resolve) => {
    new gw.google.maps.Geocoder().geocode(
      {
        address,
        componentRestrictions: { country: "ZA" },
      },
      (results: any[], status: string) => {
        if (status === "OK" && results?.[0]?.geometry?.location) {
          resolve(results[0].geometry.location);
        } else {
          console.warn(`[useDeliveryMap] Geocoding failed for "${address}": ${status}`);
          resolve(null);
        }
      },
    );
  });
}

// ── Pin Element Factory ───────────────────────────────────────────────────
function createCustomPin(gw: any, color: string, labelText: string) {
  const pinContainer = document.createElement("div");
  pinContainer.innerHTML = `<div style="background-color: ${color}; color: white; border: 2px solid white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-family: sans-serif; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${labelText}</div>`;
  return pinContainer.firstElementChild as HTMLElement;
}

function createCourierPin(gw: any) {
  const pinContainer = document.createElement("div");
  pinContainer.style.position = "relative";
  pinContainer.style.display = "flex";
  pinContainer.style.alignItems = "center";
  pinContainer.style.justifyContent = "center";
  pinContainer.innerHTML = `
    <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: #f59e0b; opacity: 0.45; animation: courier-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: relative; z-index: 10; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: 2.5px solid white; border-radius: 50%; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.35);">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
          <path d="M15 18H9"/>
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
          <circle cx="17" cy="18" r="2"/>
          <circle cx="7" cy="18" r="2"/>
        </svg>
      </div>
    </div>
    <style>
      @keyframes courier-ping {
        75%, 100% {
          transform: scale(1.6);
          opacity: 0;
        }
      }
    </style>
  `;
  return { element: pinContainer };
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useDeliveryMap(
  mapRef: RefObject<HTMLDivElement | null>,
  originAddress: string,
  destAddress: string,
  progress: number,
  claimedAt: string | null,
  collectionDatetime: string | null,
): DeliveryMapResult {
  const mapsReady = useGoogleMapsCore();

  const [routeReady, setRouteReady] = useState(false);
  const [distanceText, setDistanceText] = useState("");
  const [durationText, setDurationText] = useState("");
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const courierMarkerRef = useRef<any>(null);
  const routePathRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapsReady) return;
    if (!mapRef.current) return;
    if (!originAddress || originAddress === "Location not specified") return;
    if (!destAddress || destAddress === "Location not specified") return;

    const gw = window as any;
    let cancelled = false;

    async function initMap() {
      if (!mapRef.current) return;

      setRouteReady(false);
      setGeocodeError(null);
      setDistanceText("");
      setDurationText("");

      mapRef.current.innerHTML = "";

      const defaultCenter = { lat: -26.2041, lng: 28.0473 };

      // ── 1. Create Map Canvas IMMEDIATELY ──────────────────────────────
      const map = new gw.google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 12,
        mapId: "DEMO_MAP_ID",
        mapTypeControl: false,
        fullscreenControl: true,
        streetViewControl: false,
        zoomControl: true,
      });
      mapInstanceRef.current = map;

      setTimeout(() => {
        if (gw.google?.maps?.event) {
          gw.google.maps.event.trigger(map, "resize");
        }
      }, 100);

      // ── 2. Geocode Addresses ─────────────────────────────────────────────
      const [originLL, destLL] = await Promise.all([
        geocodeAddress(originAddress),
        geocodeAddress(destAddress),
      ]);

      if (cancelled) return;

      if (!originLL || !destLL) {
        setGeocodeError(
          !originLL && !destLL
            ? "Could not resolve the pickup or delivery address."
            : !originLL
              ? "Could not resolve the donor's pickup address."
              : "Could not resolve your organisation's address.",
        );
        return;
      }

      const bounds = new gw.google.maps.LatLngBounds();
      bounds.extend(originLL);
      bounds.extend(destLL);
      map.fitBounds(bounds, 60);

      // ── 3. Advanced Markers for Pickup and NGO Destination ────────────────
      const { AdvancedMarkerElement } = gw.google.maps.marker;

      new AdvancedMarkerElement({
        position: originLL,
        map,
        title: "Donor Pickup Location",
        content: createCustomPin(gw, "#16a34a", "D"),
        zIndex: 100,
      });

      new AdvancedMarkerElement({
        position: destLL,
        map,
        title: "Your Organisation",
        content: createCustomPin(gw, "#2563eb", "N"),
        zIndex: 100,
      });

      // ── 4. Routes API calculation ───────────────────────────────────────
      let decodedPath: any[] = [];

      try {
        const directionsService = new gw.google.maps.DirectionsService();
        const request = {
          origin: originLL,
          destination: destLL,
          travelMode: gw.google.maps.TravelMode.DRIVING,
        };

        const response = await new Promise<any>((resolve, reject) => {
          directionsService.route(request, (res: any, status: string) => {
            if (status === "OK") resolve(res);
            else reject(new Error(status));
          });
        });

        if (response.routes && response.routes.length > 0) {
          const route = response.routes[0];
          const leg = route.legs?.[0];
          // Extract high-density street path from steps so the polyline hugs every street corner
          if (leg?.steps && leg.steps.length > 0) {
            const stepPoints = leg.steps.flatMap((step: any) => step.path || []);
            decodedPath = stepPoints.length > 0 ? stepPoints : route.overview_path || [];
          } else {
            decodedPath = route.overview_path || [];
          }

          if (leg) {
            setDistanceText(leg.distance?.text || "");
            setDurationText(leg.duration?.text || "");
          }
        }
      } catch (routesErr) {
        console.warn("[useDeliveryMap] DirectionsService failed, trying OSRM fallback:", routesErr);
      }

      // Fallback: Road routing via public OSRM road routing API
      if (decodedPath.length === 0) {
        try {
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLL.lng()},${originLL.lat()};${destLL.lng()},${destLL.lat()}?overview=full&geometries=geojson`;
          const osrmRes = await fetch(osrmUrl);
          if (osrmRes.ok) {
            const data = await osrmRes.json();
            if (data.routes && data.routes.length > 0) {
              const osrmRoute = data.routes[0];
              const coords: [number, number][] = osrmRoute.geometry?.coordinates || [];
              decodedPath = coords.map((c) => new gw.google.maps.LatLng(c[1], c[0]));
              setDistanceText(`${(osrmRoute.distance / 1000).toFixed(1)} km`);
              setDurationText(formatDuration(osrmRoute.duration / 60));
            }
          }
        } catch (osrmErr) {
          console.warn("[useDeliveryMap] OSRM routing fallback failed:", osrmErr);
        }
      }

      // Hard Fallback: Straight path between origin and destination only if both fail
      if (decodedPath.length === 0) {
        decodedPath = [originLL, destLL];
        const meters = gw.google.maps.geometry?.spherical
          ? gw.google.maps.geometry.spherical.computeLength(decodedPath)
          : computeDistanceBetween(originLL, destLL);
        setDistanceText(`${(meters / 1000).toFixed(1)} km`);

        const rawMins = Math.max(1, (meters / 1000 / 35) * 60);
        setDurationText(formatDuration(rawMins));
      }

      if (cancelled) return;

      routePathRef.current = decodedPath;

      // Render Polyline on Map
      if (polylineRef.current) polylineRef.current.setMap(null);

      const polyline = new gw.google.maps.Polyline({
        path: decodedPath,
        geodesic: true,
        strokeColor: "#3b82f6",
        strokeWeight: 5,
        strokeOpacity: 0.8,
        map,
      });
      polylineRef.current = polyline;

      const polylineBounds = new gw.google.maps.LatLngBounds();
      decodedPath.forEach((pt: any) => polylineBounds.extend(pt));
      map.fitBounds(polylineBounds, 60);

      // ── 5. Courier Advanced Marker ────────────────────────────────────
      const initPos = interpolateAlongPath(decodedPath, progress);

      const courierMarker = new AdvancedMarkerElement({
        position: initPos,
        map,
        title: "Courier",
        content: createCourierPin(gw).element,
        zIndex: 999,
      });
      courierMarkerRef.current = courierMarker;

      // ── 6. Courier movement animation loop ────────────────────────────
      function placeAt(p: number) {
        const pos = interpolateAlongPath(decodedPath, p);
        if (!pos) return;
        courierMarker.position = pos;
        if (map && typeof map.panTo === "function") {
          map.panTo(pos);
        }
      }

      function easeInOut(t: number) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      }

      const INTRO_MS = 2500;
      const introStart = performance.now();
      const introEnd = progress;

      let rafId: number;
      let tickerId: ReturnType<typeof setInterval>;

      function introFrame(now: number) {
        if (cancelled) return;
        const t = Math.min((now - introStart) / INTRO_MS, 1);
        const p = easeInOut(t) * introEnd;
        placeAt(p);

        if (t < 1) {
          rafId = requestAnimationFrame(introFrame);
        } else {
          tickerId = setInterval(() => {
            if (cancelled) {
              clearInterval(tickerId);
              return;
            }
            const { progress: p2 } = getDeliveryProgress(claimedAt, collectionDatetime);
            placeAt(Math.min(p2, 1));
          }, 1000);
        }
      }

      rafId = requestAnimationFrame(introFrame);

      (courierMarker as any).__rafId = () => cancelAnimationFrame(rafId);
      (courierMarker as any).__tickerId = () => clearInterval(tickerId);

      setRouteReady(true);
    }

    initMap();

    return () => {
      cancelled = true;
      const m = courierMarkerRef.current;
      if (m) {
        m.__rafId?.();
        m.__tickerId?.();
      }
      if (polylineRef.current) polylineRef.current.setMap(null);
      courierMarkerRef.current = null;
      mapInstanceRef.current = null;
      routePathRef.current = [];
      if (mapRef.current) mapRef.current.innerHTML = "";
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsReady, originAddress, destAddress]);

  // Fallback update for progress ticks
  useEffect(() => {
    const marker = courierMarkerRef.current;
    const path = routePathRef.current;
    if (!marker || path.length === 0) return;

    const pos = interpolateAlongPath(path, progress);
    if (pos) {
      marker.position = pos;
      mapInstanceRef.current?.panTo(pos);
    }
  }, [progress]);

  return { routeReady, distanceText, durationText, geocodeError };
}
