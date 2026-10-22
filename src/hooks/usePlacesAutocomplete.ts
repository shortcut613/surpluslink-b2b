import { useEffect, useState, useRef } from "react";

export function usePlacesAutocomplete(
  containerElement: HTMLDivElement | null,
  onPlaceSelect: (formattedAddress: string, city: string) => void,
) {
  const [isReady, setIsReady] = useState(false);
  const onSelectRef = useRef(onPlaceSelect);

  // Keep callback reference updated without triggering re-renders
  useEffect(() => {
    onSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  // Load Google Maps API with loading=async
  useEffect(() => {
    if ((window as any).google?.maps?.places) {
      setIsReady(true);
      return;
    }

    if (!(window as any)._placesReadyCallbacks) {
      (window as any)._placesReadyCallbacks = [];
    }

    (window as any)._placesReadyCallbacks.push(() => setIsReady(true));

    const existing = document.getElementById("google-places-script");
    if (existing) {
      existing.addEventListener("load", () => {
        if ((window as any).google?.maps?.places) setIsReady(true);
      });
      return;
    }

    const script = document.createElement("script");
    script.id = "google-places-script";
    // Includes loading=async parameter to satisfy console warnings
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places,routes&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if ((window as any)._placesReadyCallbacks) {
        (window as any)._placesReadyCallbacks.forEach((cb: () => void) => cb());
      }
    };
    document.head.appendChild(script);
  }, []);

  // Initialize PlaceAutocompleteElement
  useEffect(() => {
    if (!isReady || !containerElement || !(window as any).google?.maps?.places) return;

    // Instantiate modern PlaceAutocompleteElement web component
    const autocompleteElement = new (window as any).google.maps.places.PlaceAutocompleteElement({
      componentRestrictions: { country: "ZA" },
    });

    // Clear previous children and mount web component
    containerElement.innerHTML = "";
    containerElement.appendChild(autocompleteElement);

    // Listen for place selection via gmp-placeselect event
    const handlePlaceSelect = async (event: any) => {
      const place = event.place;
      if (!place) return;

      // Fetch required fields explicitly
      await place.fetchFields({
        fields: ["formattedAddress", "addressComponents"],
      });

      let city = "";
      if (place.addressComponents) {
        for (const comp of place.addressComponents) {
          if (
            comp.types.includes("locality") ||
            comp.types.includes("administrative_area_level_2")
          ) {
            city = comp.longText || comp.shortText || "";
            break;
          }
        }
      }

      onSelectRef.current(place.formattedAddress || "", city);
    };

    autocompleteElement.addEventListener("gmp-placeselect", handlePlaceSelect);

    return () => {
      autocompleteElement.removeEventListener("gmp-placeselect", handlePlaceSelect);
      if (containerElement) {
        containerElement.innerHTML = "";
      }
    };
  }, [isReady, containerElement]);

  return isReady;
}
