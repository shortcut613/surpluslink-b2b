import React, { useEffect, useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useLocation } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getFastCachedAuth } from "@/hooks/useAuth";

export function ProductTour() {
  const isInitialized = useRef(false);
  const location = useLocation();

  useEffect(() => {
    // Only run once per session load to avoid spamming
    if (isInitialized.current) return;
    isInitialized.current = true;

    const checkAndRunTour = async () => {
      // 1. Check if user is logged in
      const cachedAuth = getFastCachedAuth();
      let currentUser = cachedAuth.user;

      if (!currentUser) {
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 1000),
        );
        const {
          data: { session },
        } = await Promise.race([supabase.auth.getSession(), timeoutPromise]);
        currentUser = session?.user ?? null;
      }
      if (!currentUser) return;

      const role = currentUser.user_metadata?.role;
      if (!role || role === "admin") return;

      // 2. Check localStorage to see if tour was already shown
      const tourKey = `has_seen_tour_${role}`;
      if (localStorage.getItem(tourKey)) return;

      // 3. Prevent running on mobile where sidebar is hidden
      if (window.innerWidth < 768) return;

      // Ensure DOM has settled
      setTimeout(() => {
        let steps: any[] = [];

        if (role === "ngo") {
          steps = [
            {
              popover: {
                title: "Welcome to SurplusLink! 🤝",
                description:
                  "Let's take a quick tour to show you how to find and claim surplus food for your community.",
                side: "left",
                align: "start",
              },
            },
            {
              element: '[href="/ngo/dashboard"]',
              popover: {
                title: "Your Dashboard",
                description:
                  "This is your home base. Track your overall impact and see pending verifications here.",
                side: "right",
              },
            },
            {
              element: '[href="/ngo/explore"]',
              popover: {
                title: "Find Food",
                description:
                  "Head here to browse available food batches and secure them before they expire.",
                side: "right",
              },
            },
            {
              element: '[href="/ngo/claims"]',
              popover: {
                title: "Manage Claims",
                description:
                  "View collection details and instructions for the food you've successfully claimed.",
                side: "right",
              },
            },
          ];
        } else if (role === "donor") {
          steps = [
            {
              popover: {
                title: "Welcome to SurplusLink! 🌟",
                description:
                  "Thank you for joining our mission. Let's show you how to start making an impact.",
                side: "left",
                align: "start",
              },
            },
            {
              element: '[href="/donor/dashboard"]',
              popover: {
                title: "Your Dashboard",
                description: "Monitor your active donations and see how much food you've rescued.",
                side: "right",
              },
            },
            {
              element: '[href="/donor/donate/batch"]',
              popover: {
                title: "Donate Food",
                description:
                  "Click here anytime to list a new surplus food batch for NGOs to claim.",
                side: "right",
              },
            },
            {
              element: '[href="/donor/impact"]',
              popover: {
                title: "Your Impact & Tax",
                description:
                  "Access your automatic Section 18A tax certificates and CSR reports here.",
                side: "right",
              },
            },
          ];
        }

        if (steps.length === 0) return;

        const driverObj = driver({
          showProgress: true,
          animate: true,
          overlayColor: "rgba(0, 0, 0, 0.7)",
          popoverClass: "driverjs-theme", // We'll add custom styles in CSS
          steps: steps,
          onDestroyStarted: () => {
            localStorage.setItem(tourKey, "true");
            if (driverObj.hasNextStep()) {
              toast.info("Tour skipped. You can explore SurplusLink anytime.");
            }
            driverObj.destroy();
          },
        });

        driverObj.drive();
      }, 1000); // 1s delay for full layout rendering
    };

    checkAndRunTour();
  }, [location.pathname]); // Re-evaluate if they hit a new route, though it won't run twice due to isInitialized

  return null;
}
