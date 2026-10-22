import React from "react";
import logoUrl from "../assets/SurplusLink_logo.svg";

export function Logo({ className = "h-10", ...props }: React.HTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src={logoUrl}
      alt="SurplusLink Logo"
      className={`w-auto object-contain dark:bg-white dark:p-1 dark:rounded ${className}`}
      {...(props as any)}
    />
  );
}
