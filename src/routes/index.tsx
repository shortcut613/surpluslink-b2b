import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Camera,
  Radio,
  Truck,
  MapPin,
  Bell,
  PackageCheck,
  ShieldCheck,
  BadgeCheck,
  ClipboardCheck,
  HeartHandshake,
  Banknote,
  Truck as TruckIcon,
  Users,
} from "lucide-react";
import { Logo } from "@/components/Logo";

import { createServerFn } from "@tanstack/react-start";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

export const getLandingStats = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createSupabaseServerClient();
  const [ngoRes, batchRes] = await Promise.all([
    supabase.from("ngos").select("id", { count: "exact", head: true }).eq("is_verified", true),
    supabase.from("donation_batches").select("status, donation_items(quantity, unit)"),
  ]);

  let totalKg = 0;
  (batchRes.data || []).forEach((b) => {
    if (b.status === "Cancelled" || b.status === "Failed") return;
    b.donation_items?.forEach((item: any) => {
      const q = Number(item.quantity) || 0;
      let mult = 1;
      if (item.unit?.toLowerCase().includes("g") && !item.unit?.toLowerCase().includes("kg"))
        mult = 0.001;
      if (item.unit?.toLowerCase().includes("ton")) mult = 1000;
      totalKg += q * mult;
    });
  });

  const totalMeals = totalKg / 0.4;
  const co2 = totalKg * 2.5; // Roughly 2.5kg CO2e per kg of food waste

  return {
    ngos: ngoRes.count || 0,
    meals: Math.round(totalMeals),
    co2: Math.round(co2),
  };
});

export const landingStatsQueryOptions = queryOptions({
  queryKey: ["landing", "stats"],
  queryFn: () => getLandingStats(),
  staleTime: 60000,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SurplusLink — Connecting Excess to Impact" },
      {
        name: "description",
        content:
          "SurplusLink is the real-time bridge between food donors and vetted NGOs. Rescue edible surplus food before it goes to waste.",
      },
      { property: "og:title", content: "SurplusLink — Connecting Excess to Impact" },
      {
        property: "og:description",
        content:
          "An instant communication channel between food donors and NGOs. Post surplus, get matched, rescue meals.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(landingStatsQueryOptions),
  component: Landing,
});

function smoothScroll(id: string) {
  return (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
}

function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { id: "how", label: "How It Works" },
    { id: "donors", label: "For Donors" },
    { id: "ngos", label: "For NGOs" },
    { id: "wallet", label: "Community Wallet" },
  ];

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? "glass-nav shadow-sm" : "bg-white/60 backdrop-blur-lg border-b border-black/5"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center px-6">
        <div className="flex flex-1 justify-start">
          <a href="#top" onClick={smoothScroll("top")} className="flex items-center shrink-0">
            <Logo className="h-8" />
          </a>
        </div>
        <nav className="hidden items-center justify-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              onClick={smoothScroll(l.id)}
              className="text-sm font-medium text-neutral-600 transition-colors hover:text-primary"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden flex-1 items-center justify-end gap-3 md:flex">
          <Link
            to="/login"
            className="inline-flex h-10 items-center justify-center rounded-full border border-primary/30 bg-white/80 px-5 text-sm font-semibold text-primary transition-all hover:bg-primary hover:text-white hover:shadow-md hover:shadow-primary/20"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="group inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-md shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/40 hover:-translate-y-0.5"
          >
            Register as Donor or NGO
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end gap-3 md:hidden">
          <Link
            to="/login"
            className="inline-flex h-9 items-center justify-center rounded-full border border-primary/30 bg-white/80 px-4 text-sm font-semibold text-primary transition-all hover:bg-primary hover:text-white"
          >
            Sign In
          </Link>
          <button
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
            className="flex items-center justify-center rounded-full w-9 h-9 bg-white/80 border border-black/10 shadow-sm"
          >
            <div className="space-y-1.5">
              <span className="block h-0.5 w-5 bg-neutral-700" />
              <span className="block h-0.5 w-5 bg-neutral-700" />
              <span className="block h-0.5 w-5 bg-neutral-700" />
            </div>
          </button>
        </div>
      </div>
      {open && (
        <div className="glass-nav border-t border-black/5 px-6 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {links.map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                onClick={(e) => {
                  smoothScroll(l.id)(e);
                  setOpen(false);
                }}
                className="text-sm font-medium text-neutral-700 hover:text-primary transition-colors"
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/login"
              className="mt-2 inline-flex h-10 items-center justify-center rounded-full border border-primary/30 bg-white px-5 text-sm font-semibold text-primary"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-md shadow-primary/30"
            >
              Register
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-background scroll-mt-16">
      {/* Subtle background blobs for depth — light blue tints */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-[600px] w-[600px] rounded-full bg-primary/6 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/2 -right-40 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-sky-400/5 blur-[80px]" />

      <div className="relative mx-auto max-w-7xl px-6 py-12 md:py-20">
        <div className="grid items-center gap-12 md:grid-cols-12">
          <div className="md:col-span-7">
            <h1 className="text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
              Turn Extra
              <br />
              Food Into
              <br />
              <span className="italic text-primary">Real Impact.</span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-neutral-600">
              SurplusLink connects businesses with extra food to charities that need it. We help you
              reduce food waste and feed communities easily.
            </p>
            <div className="mt-10 flex items-center gap-4">
              <Link
                to="/register"
                className="group inline-flex h-14 items-center justify-center gap-2.5 rounded-full bg-primary px-8 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5"
              >
                Join the Network
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#how"
                onClick={smoothScroll("how")}
                className="text-sm font-medium text-neutral-500 transition-colors hover:text-primary"
              >
                See how it works
              </a>
            </div>
          </div>

          <div className="md:col-span-5">
            <ImageCarousel />
          </div>
        </div>
      </div>
    </section>
  );
}

function ImageCarousel() {
  const images = [
    "/images/surpluslink1.png",
    "/images/surpluslink2.png",
    "/images/surpluslink3.png",
    "/images/surpluslink4.png",
  ];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % images.length), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative">
      {/* Outer glass frame */}
      <div className="absolute -inset-4 rounded-3xl glass opacity-60" />
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-neutral-900 text-white shadow-2xl shadow-primary/15">
        <img
          src={images[idx % images.length]}
          alt={`SurplusLink food rescue — image ${(idx % images.length) + 1} of ${images.length}`}
          className="h-full w-full object-cover transition-opacity duration-500"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute left-4 bottom-4 rounded-xl glass px-3 py-2 text-sm text-white border-white/20">
          <span className="font-semibold">SurplusLink</span>
        </div>
        {/* Dot indicators */}
        <div className="absolute bottom-4 right-4 flex gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Show image ${i + 1} of ${images.length}`}
              className={`h-1.5 rounded-full transition-all ${i === idx % images.length ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Stats() {
  const items = [
    { value: "2.48M", label: "Meals Rescued (Target)" },
    { value: "640+", label: "Charity Partners (Goal)" },
    { value: "1.2K Tonnes", label: "CO₂ Prevented (Projected)" },
    { value: "Instant", label: "Average Match Speed" },
  ];
  return (
    <section className="relative overflow-hidden bg-primary">
      {/* Subtle texture blobs inside the navy banner */}
      <div className="pointer-events-none absolute -top-10 -left-10 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-48 w-48 rounded-full bg-white/5 blur-2xl" />

      <div className="relative mx-auto max-w-7xl px-6 py-14 sm:py-20 md:py-24">
        <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          {items.map((s, i) => (
            <div
              key={s.label}
              className={`${i !== 0 ? "md:border-l md:border-white/15 md:pl-6" : "md:pl-0"} flex flex-col justify-center text-center md:text-left py-6 sm:py-8`}
            >
              <div
                className="font-black tracking-tight leading-tight text-white break-words"
                style={{ fontSize: "clamp(1.5rem, 5.5vw, 3.25rem)" }}
              >
                {s.value}
              </div>
              <div className="mt-3 text-xs uppercase tracking-widest text-primary-foreground/60">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const donorSteps = [
    {
      icon: Camera,
      title: "List your extra food",
      desc: "Add details like what it is and when to pick it up.",
    },
    { icon: Radio, title: "Notify charities", desc: "Local charities get an alert instantly." },
    {
      icon: Truck,
      title: "Food is collected",
      desc: "The charity picks it up safely and you get a receipt.",
    },
  ];
  const ngoSteps = [
    {
      icon: MapPin,
      title: "Tell us what you need",
      desc: "Set your location and what food you can accept.",
    },
    {
      icon: Bell,
      title: "Get instant alerts",
      desc: "We notify you as soon as food is available.",
    },
    { icon: PackageCheck, title: "Collect the food", desc: "Pick it up and feed your community." },
  ];
  return (
    <section id="how" className="relative overflow-hidden bg-background scroll-mt-16">
      {/* Background depth blobs */}
      <div className="pointer-events-none absolute top-0 right-0 h-[400px] w-[400px] rounded-full bg-primary/4 blur-[100px]" />

      <div className="relative mx-auto max-w-7xl px-6 py-24">
        <div className="mb-16 max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">
            How it works
          </div>
          <h2 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
            How we make it happen.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Column id="donors" label="For Donors" heading="Have Extra Food?" steps={donorSteps} />
          <Column id="ngos" label="For Charities" heading="Need Food?" steps={ngoSteps} dark />
        </div>
      </div>
    </section>
  );
}

function Column({
  id,
  label,
  heading,
  steps,
  dark,
}: {
  id: string;
  label: string;
  heading: string;
  steps: { icon: React.ElementType; title: string; desc: string }[];
  dark?: boolean;
}) {
  return (
    <div
      id={id}
      className={`scroll-mt-20 rounded-3xl p-10 md:p-12 ${
        dark ? "bg-primary text-white shadow-xl shadow-primary/20" : "glass text-foreground"
      }`}
    >
      <div
        className={`text-xs font-semibold uppercase tracking-widest ${dark ? "text-primary-foreground/60" : "text-primary"}`}
      >
        {label}
      </div>
      <h3 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">{heading}</h3>
      <ol className="mt-10 space-y-8">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-5">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${
                dark ? "border-white/30 bg-white/10" : "border-primary/20 bg-primary/8"
              }`}
            >
              <s.icon className={`h-5 w-5 ${dark ? "text-white" : "text-primary"}`} />
            </div>
            <div className="min-w-0">
              <div
                className={`text-xs uppercase tracking-widest ${dark ? "text-primary-foreground/50" : "text-primary/60"}`}
              >
                Step 0{i + 1}
              </div>
              <div className="mt-1 text-lg font-bold">{s.title}</div>
              <div
                className={`mt-1 text-sm ${dark ? "text-primary-foreground/70" : "text-neutral-600"}`}
              >
                {s.desc}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Trust() {
  const items = [
    {
      icon: ShieldCheck,
      title: "Verified Charities",
      desc: "Every charity is checked and approved before they can join.",
    },
    {
      icon: ClipboardCheck,
      title: "Tracked Pickups",
      desc: "You get a signed receipt for every donation.",
    },
    {
      icon: BadgeCheck,
      title: "Food Safety",
      desc: "We follow strict food safety guidelines and regulations.",
    },
  ];
  return (
    <section className="relative overflow-hidden bg-background">
      <div className="pointer-events-none absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-primary/5 blur-[100px]" />

      <div className="relative mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">
              Trust & Compliance
            </div>
            <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight md:text-5xl">
              Safe, verified, and secure.
            </h2>
            <p className="mt-6 max-w-md text-muted-foreground">
              We take food safety seriously. Every charity is checked, every pickup is tracked, and
              everyone is held accountable to ensure safe food delivery.
            </p>
          </div>
          <div className="md:col-span-7">
            <div className="flex flex-col gap-4">
              {items.map((it) => (
                <div
                  key={it.title}
                  className="glass rounded-2xl flex gap-5 p-7 transition-all hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                    <it.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-bold">{it.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{it.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="relative overflow-hidden bg-primary">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
      </div>
      <div className="relative mx-auto max-w-7xl px-6 py-24 text-center">
        <h2 className="mx-auto max-w-3xl text-4xl font-black leading-tight tracking-tight text-white md:text-6xl">
          The next meal is already on the shelf.{" "}
          <span className="italic text-primary-foreground/70">Don't let it expire.</span>
        </h2>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/register"
            className="inline-flex h-14 items-center justify-center rounded-full glass px-8 text-sm font-semibold text-white border-white/30 transition-all hover:bg-white/20 hover:shadow-lg"
          >
            I'm a Donor
          </Link>
          <Link
            to="/register"
            className="inline-flex h-14 items-center justify-center rounded-full bg-white px-8 text-sm font-semibold text-primary shadow-lg transition-all hover:bg-white/90 hover:shadow-xl hover:-translate-y-0.5"
          >
            I'm a Charity
          </Link>
        </div>
      </div>
    </section>
  );
}

function CommunityWallet() {
  const perks = [
    {
      icon: TruckIcon,
      title: "Pay for transport",
      desc: "Help charities cover fuel costs so they can collect food.",
    },
    {
      icon: Banknote,
      title: "Keep the platform free",
      desc: "Ensure SurplusLink remains completely free for everyone.",
    },
    {
      icon: Users,
      title: "Grow the network",
      desc: "Help us reach more businesses and charities.",
    },
  ];

  return (
    <section id="wallet" className="relative overflow-hidden bg-background">
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full bg-primary/5 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-6 py-24">
        <div className="mb-16 flex flex-col items-center text-center">
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">
            Community Wallet
          </div>
          <h2 className="mt-3 max-w-2xl text-4xl font-black tracking-tight md:text-5xl">
            Can't donate food? Help fund the cause.
          </h2>
          <p className="mt-5 max-w-xl text-muted-foreground leading-relaxed">
            Rescuing food costs money for transport and storage. Your donation helps charities pay
            for these costs so no food goes to waste.
          </p>
        </div>

        <div className="mx-auto max-w-4xl rounded-3xl glass-lg shadow-2xl shadow-primary/20 overflow-hidden">
          <div className="grid md:grid-cols-2">
            {/* Left — perks */}
            <div className="p-10 md:p-12">
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/15">
                <HeartHandshake className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-2xl font-black tracking-tight">Every donation helps.</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                The Community Wallet collects donations to help registered charities pay for the
                transport needed to collect food.
              </p>
              <ul className="mt-8 space-y-5">
                {perks.map((p) => (
                  <li key={p.title} className="flex items-start gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 border border-primary/12">
                      <p.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{p.title}</div>
                      <div className="mt-0.5 text-xs text-neutral-500">{p.desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — CTA panel */}
            <div className="flex flex-col items-center justify-center gap-6 bg-primary/5 border-t md:border-t-0 md:border-l border-primary/10 p-10 md:p-12 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border border-primary/15">
                <HeartHandshake className="h-9 w-9 text-primary" />
              </div>
              <div>
                <div className="text-lg font-black tracking-tight">Make an impact today</div>
                <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                  No food to spare? A financial contribution helps cover transport costs and gets
                  food to families who need it most.
                </p>
              </div>
              <Link
                to="/community-wallet"
                className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5"
              >
                <HeartHandshake className="h-4 w-4" />
                Contribute to the Wallet
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <p className="text-xs text-neutral-400">
                Secure payment · All contributions go directly to logistics costs
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative overflow-hidden bg-background border-t border-black/5">
      <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 rounded-full bg-primary/4 blur-[80px]" />

      <div className="relative mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <Logo className="h-8 mb-4" />
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              Connecting food donors with registered charities to stop food waste.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const emailInput = form.querySelector<HTMLInputElement>('input[type="email"]');
                const email = emailInput?.value?.trim();
                if (!email) return;
                toast.success("You're on the list! We'll be in touch soon.");
                if (emailInput) emailInput.value = "";
              }}
              className="mt-8 flex max-w-sm items-center gap-2 rounded-full glass border border-primary/15 p-1 shadow-sm"
            >
              <input
                id="footer-email"
                type="email"
                placeholder="Your email"
                aria-label="Subscribe to SurplusLink updates"
                className="h-10 w-full bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button className="h-10 shrink-0 rounded-full bg-primary px-5 text-xs font-semibold uppercase tracking-widest text-white shadow-md shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-lg">
                Subscribe
              </button>
            </form>
          </div>
          <FooterCol
            title="Platform"
            links={[
              { label: "How It Works", to: "/#how" },
              { label: "For Donors", to: "/register" },
              { label: "For NGOs", to: "/register" },
              { label: "Community Wallet", to: "/community-wallet" },
            ]}
          />
          <FooterCol
            title="Legal"
            links={[
              { label: "Privacy Policy", to: "/privacy" },
              { label: "Terms of Service", to: "/terms" },
              { label: "Cookie Policy", to: "/cookies" },
            ]}
          />
          <FooterCol
            title="Contact"
            links={[
              { label: "hello@surpluslink.org", to: "mailto:hello@surpluslink.org" },
              { label: "+27 21 000 0000", to: "tel:+27210000000" },
              { label: "Cape Town, ZA", to: null },
            ]}
          />
        </div>
        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-black/6 pt-8 text-xs text-neutral-500 md:flex-row md:items-center">
          <div>© {new Date().getFullYear()} SurplusLink. All rights reserved.</div>
          <div className="max-w-xl md:text-right">
            SurplusLink follows all food safety rules. Every charity partner is carefully checked.
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; to: string | null }>;
}) {
  return (
    <div className="md:col-span-2">
      <div className="text-xs font-semibold uppercase tracking-widest text-primary">{title}</div>
      <ul className="mt-4 space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            {l.to ? (
              l.to.startsWith("/") ? (
                <Link
                  to={l.to as any}
                  className="text-sm text-neutral-700 hover:text-primary hover:underline transition-colors"
                >
                  {l.label}
                </Link>
              ) : (
                <a
                  href={l.to}
                  className="text-sm text-neutral-700 hover:text-primary hover:underline transition-colors"
                >
                  {l.label}
                </a>
              )
            ) : (
              <span className="text-sm text-neutral-400 cursor-default" title="Coming soon">
                {l.label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Landing() {
  return (
    <main className="page-transition min-h-screen scroll-smooth bg-background text-foreground antialiased">
      <Nav />
      <Hero />
      <Stats />
      <HowItWorks />
      <Trust />
      <CommunityWallet />
      <CTA />
      <Footer />
    </main>
  );
}
