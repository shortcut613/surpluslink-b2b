import React from "react";
import { AppHeader } from "@/components/AppHeader";
import { Link } from "@tanstack/react-router";

export function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="relative flex min-h-[calc(100vh-56px)] flex-col items-center justify-start overflow-hidden px-4 py-12 sm:py-20">
        {/* Background blobs — navy blue family */}
        <div className="pointer-events-none absolute -top-1/4 left-0 h-[600px] w-[600px] animate-pulse rounded-full bg-primary/8 blur-[150px] [animation-duration:15s]" />
        <div className="pointer-events-none absolute bottom-0 -right-1/4 h-[500px] w-[500px] animate-pulse rounded-full bg-primary/5 blur-[120px] [animation-duration:10s]" />

        <div className="relative z-10 w-full max-w-4xl">
          <Link
            to="/"
            className="mb-8 inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Home
          </Link>

          <div className="rounded-3xl glass-lg p-8 sm:p-12 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out shadow-2xl shadow-primary/20">
            <header className="mb-10 border-b border-border/40 pb-8">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Last Updated: {lastUpdated}</p>
            </header>

            <div className="prose prose-sm sm:prose-base dark:prose-invert prose-headings:font-bold prose-headings:tracking-tight prose-a:text-primary hover:prose-a:text-primary/80 prose-p:leading-relaxed prose-li:leading-relaxed max-w-none text-muted-foreground">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
