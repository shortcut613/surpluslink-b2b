import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// Convert VAPID public key (base64 URL safe) to Uint8Array for the browser API
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setLoading(false);
      return;
    }

    setIsSupported(true);

    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        return registration.pushManager.getSubscription();
      })
      .then((subscription) => {
        setIsSubscribed(!!subscription);
      })
      .catch((err) => {
        console.error("Error initialising service worker:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function subscribeUser() {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        throw new Error("VAPID public key is missing from environment variables.");
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Must be logged in to subscribe to notifications.");

      const subData = JSON.parse(JSON.stringify(subscription));

      const { error: dbError } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: subData.endpoint,
          p256dh: subData.keys.p256dh,
          auth: subData.keys.auth,
        },
        { onConflict: "endpoint" },
      );

      if (dbError) {
        console.error("Error saving subscription to DB:", dbError);
      }

      setIsSubscribed(true);
      toast.success("Notifications enabled!", {
        description: "You'll now receive updates about your donations.",
      });
    } catch (err: any) {
      console.error("Failed to subscribe user", err);
      toast.error("Failed to enable notifications", {
        description: err.message || "Please allow notifications in your browser settings.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribeUser() {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        const { error: dbError } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", subscription.endpoint);

        if (dbError) {
          console.error("Error removing subscription from DB:", dbError);
        }
      }

      setIsSubscribed(false);
      toast.success("Notifications disabled.", {
        description: "You won't receive push alerts on this device.",
      });
    } catch (err: any) {
      console.error("Failed to unsubscribe user", err);
      toast.error("Failed to disable notifications", {
        description: err.message || "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  const toggleSubscription = () => {
    if (isSubscribed) {
      return unsubscribeUser();
    } else {
      return subscribeUser();
    }
  };

  return { isSupported, isSubscribed, loading, toggleSubscription };
}
