import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Field } from "@/components/Field";
import { toast } from "sonner";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { Logo } from "@/components/Logo";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// --- Types & Interfaces ---

export interface AddressComponents {
  streetNumber: string;
  streetName: string;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  formatted: string;
  lat: number | null;
  lng: number | null;
}

const BUSINESS_TYPES = [
  "Grocery / Supermarket",
  "Restaurant / Café",
  "Bakery",
  "Food Manufacturer",
  "Wholesaler / Distributor",
  "Hotel / Hospitality",
  "Catering Company",
  "Farm / Agricultural",
  "Convenience Store",
  "Other",
];

const emptyAddress = (): AddressComponents => ({
  streetNumber: "",
  streetName: "",
  suburb: "",
  city: "",
  province: "",
  postalCode: "",
  country: "",
  formatted: "",
  lat: null,
  lng: null,
});

// --- Auth Components ---

export function AddressAutocomplete({
  value,
  onChange,
}: {
  value: AddressComponents;
  onChange: (addr: AddressComponents) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<any>(null);
  const mapsReady = useGoogleMaps("places");

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!mapsReady || !containerRef.current) return;
    if (elementRef.current) return;

    const gPlaces = (window as any).google?.maps?.places;
    if (!gPlaces || !gPlaces.PlaceAutocompleteElement) return;

    const placeAutocomplete = new gPlaces.PlaceAutocompleteElement({
      componentRestrictions: { country: "ZA" },
      types: ["address"],
    });

    if (value.formatted) {
      placeAutocomplete.value = value.formatted;
    }

    elementRef.current = placeAutocomplete;
    containerRef.current.appendChild(placeAutocomplete);

    placeAutocomplete.addEventListener("gmp-select", async (event: any) => {
      const placePrediction = event.placePrediction;
      if (!placePrediction) return;
      const place = placePrediction.toPlace();
      await place.fetchFields({
        fields: ["addressComponents", "formattedAddress", "location"],
      });
      const get = (type: string) =>
        place.addressComponents?.find((c: any) => c.types.includes(type))?.longText ?? "";
      const lat = typeof place.location?.lat === "function" ? place.location.lat() : null;
      const lng = typeof place.location?.lng === "function" ? place.location.lng() : null;

      onChangeRef.current({
        streetNumber: get("street_number"),
        streetName: get("route"),
        suburb: get("sublocality") || get("neighborhood"),
        city: get("locality"),
        province: get("administrative_area_level_1"),
        postalCode: get("postal_code"),
        country: get("country"),
        formatted: place.formattedAddress ?? "",
        lat,
        lng,
      });
    });

    return () => {
      if (containerRef.current && elementRef.current) {
        try {
          containerRef.current.removeChild(elementRef.current);
        } catch (_) {
          /* ignore */
        }
        elementRef.current = null;
      }
    };
  }, [mapsReady]);

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-foreground">Address</label>
      {!mapsReady && (
        <input
          type="text"
          disabled
          value={value.formatted || ""}
          placeholder="Loading search…"
          className="w-full rounded-md border border-input bg-background px-3 py-3 text-base placeholder:text-muted-foreground disabled:opacity-50 sm:py-2 sm:text-sm"
        />
      )}
      <div ref={containerRef} className={!mapsReady ? "hidden" : ""} />
    </div>
  );
}

export function ComboField({
  label,
  value,
  onChange,
  onBlur,
  options,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  options: string[];
  placeholder?: string;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter((o) => o.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => setQuery(value), [value]);

  return (
    <div ref={wrapperRef} className="relative">
      <label className="mb-1.5 block text-xs font-medium text-foreground">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={onBlur}
          placeholder={placeholder}
          className={`w-full rounded-md border bg-background px-3 py-3 pr-8 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-1 transition-colors sm:py-2 sm:text-sm ${
            error
              ? "border-destructive focus:ring-destructive"
              : "border-input focus:border-ring focus:ring-ring"
          }`}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-input bg-card py-1 shadow-md">
          {filtered.map((opt) => (
            <li
              key={opt}
              onMouseDown={() => {
                setQuery(opt);
                onChange(opt);
                setOpen(false);
              }}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-secondary"
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-[11px] text-destructive leading-tight">{error}</p>}
    </div>
  );
}

export function PasswordField({
  label,
  value,
  onChange,
  error,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  onBlur?: () => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-foreground">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="••••••••"
          autoComplete="new-password"
          className={`w-full rounded-md border bg-background px-3 py-3 pr-10 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-1 transition-colors sm:py-2 sm:text-sm ${
            error
              ? "border-destructive focus:ring-destructive"
              : "border-input focus:border-ring focus:ring-ring"
          }`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          {show ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {error && <p className="text-[11px] text-destructive leading-tight">{error}</p>}
    </div>
  );
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function isValidPhone(v: string) {
  return /^[+\d][\d\s\-()]{6,}$/.test(v.trim());
}

// --- Main AuthPage Component ---

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});
type LoginForm = z.infer<typeof loginSchema>;

export function AuthPage({ defaultMode = "login" }: { defaultMode?: "login" | "register" }) {
  const navigate = useNavigate();
  const router = useRouter();

  // Sliding panel state
  const [isRightPanelActive, setIsRightPanelActive] = useState(defaultMode === "register");

  // Registration state
  const [regTab, setRegTab] = useState<"donor" | "ngo">("donor");
  const [regStep, setRegStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  const [donorData, setDonorData] = useState({
    name: "",
    type: "",
    email: "",
    phone: "",
    address: emptyAddress(),
    password: "",
    confirmPassword: "",
  });
  const [ngoData, setNgoData] = useState({
    org: "",
    reg: "",
    email: "",
    phone: "",
    address: emptyAddress(),
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Login state
  const [loginTab, setLoginTab] = useState<"donor" | "ngo">("donor");
  const {
    register: loginRegister,
    handleSubmit: handleLoginSubmit,
    setError: setLoginError,
    formState: { errors: loginErrors, isSubmitting: isLoginSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const {
    register: mobileLoginRegister,
    handleSubmit: handleMobileLoginSubmit,
    setError: setMobileLoginError,
    formState: { errors: mobileLoginErrors, isSubmitting: isMobileLoginSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // --- Registration Logic ---

  function validateStep1() {
    const e: Record<string, string> = {};
    const d = regTab === "donor" ? donorData : ngoData;
    if (regTab === "donor") {
      if (!donorData.name.trim()) e.name = "Business name is required.";
      if (!donorData.type.trim()) e.type = "Please select a business type.";
    } else {
      if (!ngoData.org.trim()) e.org = "Organisation name is required.";
      if (!ngoData.reg.trim()) e.reg = "Registration number is required.";
    }
    if (!d.email.trim()) e.email = "Email is required.";
    else if (!isValidEmail(d.email)) e.email = "Enter a valid email address.";
    if (!d.phone.trim()) e.phone = "Phone number is required.";
    else if (!isValidPhone(d.phone)) e.phone = "Enter a valid phone number.";
    return e;
  }

  function validateStep2() {
    const e: Record<string, string> = {};
    const d = regTab === "donor" ? donorData : ngoData;
    if (!d.address.formatted) e.address = "Please select an address from the suggestions.";
    if (!d.password) e.password = "Password is required.";
    else if (d.password.length < 8) e.password = "Must be at least 8 characters.";
    if (!d.confirmPassword) e.confirmPassword = "Please confirm your password.";
    else if (d.password !== d.confirmPassword) e.confirmPassword = "Passwords do not match.";
    return e;
  }

  function touch(field: string) {
    setTouched((t) => ({ ...t, [field]: true }));
    const errs = regStep === 1 ? validateStep1() : validateStep2();
    setErrors(errs);
  }
  function err(field: string) {
    return touched[field] ? errors[field] : undefined;
  }

  function onDonorChange(key: string, value: string) {
    setDonorData((prev) => {
      const next = { ...prev, [key]: value };
      if (touched[key]) setErrors(regStep === 1 ? validateStep1() : validateStep2());
      return next;
    });
  }
  function onNgoChange(key: string, value: string) {
    setNgoData((prev) => {
      const next = { ...prev, [key]: value };
      if (touched[key]) setErrors(regStep === 1 ? validateStep1() : validateStep2());
      return next;
    });
  }

  function nextStep() {
    const allKeys1 =
      regTab === "donor" ? ["name", "type", "email", "phone"] : ["org", "reg", "email", "phone"];
    setTouched((t) => ({ ...t, ...Object.fromEntries(allKeys1.map((k) => [k, true])) }));
    const errs = validateStep1();
    setErrors(errs);
    if (Object.keys(errs).length === 0) setRegStep(2);
  }

  async function handleRegisterSubmit(e: FormEvent) {
    e.preventDefault();
    if (regStep === 1) return nextStep();

    const allKeys2 = ["address", "password", "confirmPassword"];
    setTouched((t) => ({ ...t, ...Object.fromEntries(allKeys2.map((k) => [k, true])) }));
    const errs = validateStep2();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const data = regTab === "donor" ? donorData : ngoData;

      const { data: signUpData, error: supabaseError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: window.location.origin,
          data:
            regTab === "donor"
              ? {
                  role: "donor",
                  business_name: donorData.name,
                  business_type: donorData.type,
                  phone: donorData.phone,
                  address: data.address.formatted,
                  address_components: donorData.address,
                  is_verified: true,
                }
              : {
                  role: "ngo",
                  organization_name: ngoData.org,
                  registration_number: ngoData.reg,
                  phone: ngoData.phone,
                  address: data.address.formatted,
                  address_components: ngoData.address,
                  is_verified: false,
                },
        },
      });

      if (supabaseError) {
        if (
          supabaseError.status === 429 ||
          supabaseError.message.toLowerCase().includes("rate limit")
        ) {
          toast.error(
            "Too many registration attempts. Please wait a few minutes before trying again.",
          );
        } else if (supabaseError.message.toLowerCase().includes("email")) {
          setErrors({ email: supabaseError.message });
          setRegStep(1);
        } else {
          toast.error(supabaseError.message);
        }
        return;
      }

      if (signUpData.user && !signUpData.session) {
        setRegisteredEmail(data.email);
        setEmailSent(true);
        toast.success("Confirmation email sent! Please check your inbox.");
      } else {
        if (signUpData.session) {
          await supabase.auth.signOut();
        }
        toast.success("Account created successfully! Please log in.");
        setIsRightPanelActive(false);
        setRegStep(1);
        await navigate({ to: "/login" });
      }
    } catch (error) {
      console.error("Registration request failed:", error);
      toast.error("Unable to create your account. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // --- Login Logic ---
  async function doLogin(data: LoginForm, setFormError = setLoginError) {
    let signInResult: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
    try {
      signInResult = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
    } catch (requestError) {
      console.error("Sign-in request failed:", requestError);
      toast.error("Unable to sign in. Please check your connection and try again.");
      return;
    }

    const { data: authData, error } = signInResult;
    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("invalid login") ||
        msg.includes("invalid credentials") ||
        msg.includes("wrong") ||
        msg.includes("password")
      ) {
        setFormError("password", { message: "Incorrect email or password." });
      } else if (msg.includes("email")) {
        setFormError("email", { message: error.message });
      } else {
        toast.error(error.message);
      }
      return;
    }

    if (!authData.user) {
      toast.error("Sign-in succeeded, but no user session was returned. Please try again.");
      return;
    }

    const userRole = authData.user.user_metadata?.role as string | undefined;
    try {
      await router.invalidate();
      await navigate({ to: userRole === "ngo" ? "/ngo/dashboard" : "/donor/dashboard" });
      toast.success("Successfully logged in!");
    } catch (navigationError) {
      console.error("Signed-in session could not be loaded:", navigationError);
      toast.error("You are signed in, but your account could not be loaded. Please try again.");
    }
  }

  // --- Renders ---

  if (emailSent) {
    return (
      <main className="page-transition relative flex min-h-screen items-start justify-center bg-background overflow-x-hidden px-3 pt-20 pb-8 sm:px-4 sm:pt-24 sm:pb-10 md:items-center md:py-10">
        <div className="pointer-events-none absolute top-0 -left-1/4 h-[500px] w-[500px] animate-pulse rounded-full bg-primary/10 blur-[120px] [animation-duration:8s]" />
        <div className="pointer-events-none absolute bottom-0 -right-1/4 h-[600px] w-[600px] animate-pulse rounded-full bg-primary/7 blur-[150px] [animation-duration:12s]" />

        <Link
          to="/"
          className="absolute top-6 left-6 z-50 inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground bg-background/50 backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm"
        >
          &larr; Back to Home
        </Link>

        <div className="relative w-full max-w-md rounded-3xl glass-lg p-5 shadow-2xl text-center sm:p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{registeredEmail}</span>.
          </p>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Confirm your email before signing in. Check your spam folder if the message does not
            arrive.
          </p>
          <div className="mt-6">
            <Link
              to="/login"
              className="inline-block w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Desktop Sliding Panel HTML
  return (
    <main className="page-transition relative flex min-h-screen items-start justify-center bg-background overflow-x-hidden px-3 pt-20 pb-8 sm:px-4 sm:pt-24 sm:pb-10 md:items-center md:py-10">
      {/* Background blobs */}
      <div className="pointer-events-none absolute top-0 -left-1/4 h-[500px] w-[500px] animate-pulse rounded-full bg-primary/10 blur-[120px] [animation-duration:8s]" />
      <div className="pointer-events-none absolute bottom-0 -right-1/4 h-[600px] w-[600px] animate-pulse rounded-full bg-primary/7 blur-[150px] [animation-duration:12s]" />

      <Link
        to="/"
        className="absolute top-6 left-6 z-50 inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground bg-background/50 backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm"
      >
        &larr; Back to Home
      </Link>

      {/* Mobile Stacked View (<md) */}
      <div className="w-full max-w-md md:hidden space-y-6 z-10 relative">
        {/* Render only the active panel on mobile */}
        {isRightPanelActive ? (
          <div className="rounded-3xl glass-lg p-5 sm:p-8">
            <div className="mb-6 flex justify-center">
              <Logo className="h-10" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-center mb-2">Create Account</h1>

            <div className="mb-4 grid grid-cols-2 rounded-xl bg-black/5 p-1 text-sm">
              <button
                type="button"
                onClick={() => {
                  setRegTab("donor");
                  setRegStep(1);
                  setErrors({});
                  setTouched({});
                }}
                className={`min-h-11 rounded-lg py-2.5 font-medium transition-all ${regTab === "donor" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
              >
                Donor
              </button>
              <button
                type="button"
                onClick={() => {
                  setRegTab("ngo");
                  setRegStep(1);
                  setErrors({});
                  setTouched({});
                }}
                className={`min-h-11 rounded-lg py-2.5 font-medium transition-all ${regTab === "ngo" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
              >
                NGO
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} noValidate className="space-y-4">
              {regStep === 1 ? (
                <>
                  {regTab === "donor" ? (
                    <>
                      <Field
                        label="Business Name"
                        value={donorData.name}
                        onChange={(v) => onDonorChange("name", v)}
                        onBlur={() => touch("name")}
                        error={err("name")}
                      />
                      <ComboField
                        label="Business Type"
                        value={donorData.type}
                        onChange={(v) => onDonorChange("type", v)}
                        onBlur={() => touch("type")}
                        options={BUSINESS_TYPES}
                        error={err("type")}
                      />
                    </>
                  ) : (
                    <>
                      <Field
                        label="Organisation Name"
                        value={ngoData.org}
                        onChange={(v) => onNgoChange("org", v)}
                        onBlur={() => touch("org")}
                        error={err("org")}
                      />
                      <Field
                        label="NGO Registration Number"
                        value={ngoData.reg}
                        onChange={(v) => onNgoChange("reg", v)}
                        onBlur={() => touch("reg")}
                        error={err("reg")}
                      />
                    </>
                  )}
                  <Field
                    label="Email Address"
                    type="email"
                    value={regTab === "donor" ? donorData.email : ngoData.email}
                    onChange={(v) =>
                      regTab === "donor" ? onDonorChange("email", v) : onNgoChange("email", v)
                    }
                    onBlur={() => touch("email")}
                    error={err("email")}
                  />
                  <Field
                    label="Phone Number"
                    value={regTab === "donor" ? donorData.phone : ngoData.phone}
                    onChange={(v) =>
                      regTab === "donor" ? onDonorChange("phone", v) : onNgoChange("phone", v)
                    }
                    onBlur={() => touch("phone")}
                    error={err("phone")}
                  />

                  <button
                    type="submit"
                    className="min-h-11 w-full rounded-md bg-primary py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 mt-2"
                  >
                    Next
                  </button>
                </>
              ) : (
                <>
                  <AddressAutocomplete
                    value={regTab === "donor" ? donorData.address : ngoData.address}
                    onChange={(addr) =>
                      regTab === "donor"
                        ? setDonorData((prev) => ({ ...prev, address: addr }))
                        : setNgoData((prev) => ({ ...prev, address: addr }))
                    }
                  />
                  {err("address") && (
                    <p className="text-[11px] text-destructive leading-tight">{err("address")}</p>
                  )}

                  <PasswordField
                    label="Password"
                    value={regTab === "donor" ? donorData.password : ngoData.password}
                    onChange={(v) =>
                      regTab === "donor" ? onDonorChange("password", v) : onNgoChange("password", v)
                    }
                    onBlur={() => touch("password")}
                    error={err("password")}
                  />
                  <PasswordField
                    label="Confirm Password"
                    value={regTab === "donor" ? donorData.confirmPassword : ngoData.confirmPassword}
                    onChange={(v) =>
                      regTab === "donor"
                        ? onDonorChange("confirmPassword", v)
                        : onNgoChange("confirmPassword", v)
                    }
                    onBlur={() => touch("confirmPassword")}
                    error={err("confirmPassword")}
                  />

                  <div className="flex gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => setRegStep(1)}
                      className="min-h-11 w-1/3 rounded-md bg-secondary text-secondary-foreground py-3 text-base font-medium hover:bg-secondary/80"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="min-h-11 w-2/3 rounded-md bg-primary py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {loading ? "Creating…" : "Sign Up"}
                    </button>
                  </div>
                </>
              )}
            </form>
            <p className="mt-5 text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <button
                onClick={() => setIsRightPanelActive(false)}
                className="text-foreground hover:underline font-medium"
              >
                Log in
              </button>
            </p>
          </div>
        ) : (
          <div className="rounded-3xl glass-lg p-5 sm:p-8">
            <div className="mb-6 flex justify-center">
              <Logo className="h-10" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-center mb-2">Sign In</h1>
            <div className="mb-6 grid grid-cols-2 rounded-xl bg-black/5 p-1 text-sm">
              <button
                type="button"
                onClick={() => setLoginTab("donor")}
                className={`min-h-11 rounded-lg py-2.5 font-medium transition-all ${loginTab === "donor" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
              >
                Donor
              </button>
              <button
                type="button"
                onClick={() => setLoginTab("ngo")}
                className={`min-h-11 rounded-lg py-2.5 font-medium transition-all ${loginTab === "ngo" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
              >
                NGO
              </button>
            </div>
            <form
              onSubmit={handleMobileLoginSubmit((data) => doLogin(data, setMobileLoginError))}
              noValidate
              className="space-y-4"
            >
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground">Email Address</label>
                <input
                  type="email"
                  {...mobileLoginRegister("email")}
                  autoComplete="email"
                  className={`w-full rounded-md border bg-background px-3 py-3 text-base focus:outline-none focus:ring-1 sm:py-2 sm:text-sm ${mobileLoginErrors.email ? "border-destructive focus:ring-destructive" : "border-input focus:border-ring"}`}
                />
                {mobileLoginErrors.email && (
                  <p className="text-[11px] text-destructive leading-tight">
                    {mobileLoginErrors.email.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground">Password</span>
                <div className="relative">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    {...mobileLoginRegister("password")}
                    autoComplete="current-password"
                    className={`w-full rounded-md border bg-background px-3 py-3 pr-10 text-base focus:outline-none focus:ring-1 sm:py-2 sm:text-sm ${mobileLoginErrors.password ? "border-destructive focus:ring-destructive" : "border-input focus:border-ring"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((p) => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showLoginPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {mobileLoginErrors.password && (
                  <p className="text-[11px] text-destructive leading-tight">
                    {mobileLoginErrors.password.message}
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={isMobileLoginSubmitting}
                className="min-h-11 w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isMobileLoginSubmitting ? "Logging in…" : "Sign In"}
              </button>
            </form>
            <div className="mt-5 text-center text-xs text-muted-foreground flex flex-col gap-2">
              <Link to="/forgot-password" className="hover:text-foreground hover:underline">
                Forgot Password?
              </Link>
              <p>
                Don't have an account?{" "}
                <button
                  onClick={() => setIsRightPanelActive(true)}
                  className="font-medium text-foreground hover:underline"
                >
                  Register
                </button>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Sliding Panel (md+) */}
      <div
        className={`hidden md:block auth-container rounded-3xl glass-lg z-10 shadow-2xl ${isRightPanelActive ? "right-panel-active" : ""}`}
      >
        {/* Sign In Panel (Left Side of forms) */}
        <div className="auth-form-container auth-sign-in bg-white/40">
          <div className="h-full w-full flex flex-col justify-center px-10 py-8 overflow-y-auto">
            <h1 className="text-2xl font-bold tracking-tight text-center mb-2">Sign In</h1>
            <div className="mb-6 grid grid-cols-2 rounded-xl bg-black/5 p-1 text-sm max-w-sm mx-auto w-full">
              <button
                type="button"
                onClick={() => setLoginTab("donor")}
                className={`rounded-lg py-1.5 font-medium transition-all ${loginTab === "donor" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
              >
                Donor
              </button>
              <button
                type="button"
                onClick={() => setLoginTab("ngo")}
                className={`rounded-lg py-1.5 font-medium transition-all ${loginTab === "ngo" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
              >
                NGO
              </button>
            </div>
            <form
              onSubmit={handleLoginSubmit((data) => doLogin(data, setLoginError))}
              noValidate
              className="space-y-4 max-w-sm mx-auto w-full"
            >
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground text-left">
                  Email Address
                </label>
                <input
                  type="email"
                  {...loginRegister("email")}
                  autoComplete="email"
                  className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 ${loginErrors.email ? "border-destructive focus:ring-destructive" : "border-input focus:border-ring"}`}
                />
                {loginErrors.email && (
                  <p className="text-[11px] text-destructive leading-tight text-left">
                    {loginErrors.email.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground text-left">Password</span>
                <div className="relative">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    {...loginRegister("password")}
                    autoComplete="current-password"
                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 ${loginErrors.password ? "border-destructive focus:ring-destructive" : "border-input focus:border-ring"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((p) => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground px-2"
                  >
                    {showLoginPassword ? "HIDE" : "SHOW"}
                  </button>
                </div>
                {loginErrors.password && (
                  <p className="text-[11px] text-destructive leading-tight text-left">
                    {loginErrors.password.message}
                  </p>
                )}
              </div>
              <div className="text-left mt-2 mb-4">
                <Link
                  to="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  Forgot your password?
                </Link>
              </div>
              <button
                type="submit"
                disabled={isLoginSubmitting}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isLoginSubmitting ? "Logging in…" : "Sign In"}
              </button>
            </form>
          </div>
        </div>

        {/* Sign Up Panel (Right Side of forms) */}
        <div className="auth-form-container auth-sign-up bg-white/40">
          <div className="h-full w-full flex flex-col justify-center px-10 py-8 overflow-y-auto">
            <h1 className="text-2xl font-bold tracking-tight text-center mb-2">Create Account</h1>
            <div className="mb-4 grid grid-cols-2 rounded-xl bg-black/5 p-1 text-sm max-w-sm mx-auto w-full">
              <button
                type="button"
                onClick={() => {
                  setRegTab("donor");
                  setRegStep(1);
                  setErrors({});
                  setTouched({});
                }}
                className={`rounded-lg py-1.5 font-medium transition-all ${regTab === "donor" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
              >
                Donor
              </button>
              <button
                type="button"
                onClick={() => {
                  setRegTab("ngo");
                  setRegStep(1);
                  setErrors({});
                  setTouched({});
                }}
                className={`rounded-lg py-1.5 font-medium transition-all ${regTab === "ngo" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
              >
                NGO
              </button>
            </div>
            <form
              onSubmit={handleRegisterSubmit}
              noValidate
              className="space-y-4 max-w-sm mx-auto w-full text-left"
            >
              {/* Multi-step progress indicator */}
              <div className="flex items-center justify-between mb-4 px-1">
                <div
                  className={`text-xs font-semibold uppercase tracking-wider ${regStep === 1 ? "text-primary" : "text-muted-foreground"}`}
                >
                  Step 1: Details
                </div>
                <div className="flex-1 border-t border-dashed border-border mx-2" />
                <div
                  className={`text-xs font-semibold uppercase tracking-wider ${regStep === 2 ? "text-primary" : "text-muted-foreground"}`}
                >
                  Step 2: Security
                </div>
              </div>

              {regStep === 1 ? (
                <>
                  {regTab === "donor" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="Business Name"
                        value={donorData.name}
                        onChange={(v) => onDonorChange("name", v)}
                        onBlur={() => touch("name")}
                        error={err("name")}
                      />
                      <ComboField
                        label="Business Type"
                        value={donorData.type}
                        onChange={(v) => onDonorChange("type", v)}
                        onBlur={() => touch("type")}
                        options={BUSINESS_TYPES}
                        error={err("type")}
                      />
                    </div>
                  ) : (
                    <>
                      <Field
                        label="Organisation Name"
                        value={ngoData.org}
                        onChange={(v) => onNgoChange("org", v)}
                        onBlur={() => touch("org")}
                        error={err("org")}
                      />
                      <Field
                        label="Registration Number"
                        value={ngoData.reg}
                        onChange={(v) => onNgoChange("reg", v)}
                        onBlur={() => touch("reg")}
                        error={err("reg")}
                      />
                    </>
                  )}
                  <Field
                    label="Email Address"
                    type="email"
                    value={regTab === "donor" ? donorData.email : ngoData.email}
                    onChange={(v) =>
                      regTab === "donor" ? onDonorChange("email", v) : onNgoChange("email", v)
                    }
                    onBlur={() => touch("email")}
                    error={err("email")}
                  />
                  <Field
                    label="Phone Number"
                    value={regTab === "donor" ? donorData.phone : ngoData.phone}
                    onChange={(v) =>
                      regTab === "donor" ? onDonorChange("phone", v) : onNgoChange("phone", v)
                    }
                    onBlur={() => touch("phone")}
                    error={err("phone")}
                  />

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-primary mt-4 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
                  >
                    Next Step
                  </button>
                </>
              ) : (
                <>
                  <AddressAutocomplete
                    value={regTab === "donor" ? donorData.address : ngoData.address}
                    onChange={(addr) =>
                      regTab === "donor"
                        ? setDonorData((prev) => ({ ...prev, address: addr }))
                        : setNgoData((prev) => ({ ...prev, address: addr }))
                    }
                  />
                  {err("address") && (
                    <p className="mt-1 text-[11px] text-destructive leading-tight text-left">
                      {err("address")}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <PasswordField
                      label="Password"
                      value={regTab === "donor" ? donorData.password : ngoData.password}
                      onChange={(v) =>
                        regTab === "donor"
                          ? onDonorChange("password", v)
                          : onNgoChange("password", v)
                      }
                      onBlur={() => touch("password")}
                      error={err("password")}
                    />
                    <PasswordField
                      label="Confirm"
                      value={
                        regTab === "donor" ? donorData.confirmPassword : ngoData.confirmPassword
                      }
                      onChange={(v) =>
                        regTab === "donor"
                          ? onDonorChange("confirmPassword", v)
                          : onNgoChange("confirmPassword", v)
                      }
                      onBlur={() => touch("confirmPassword")}
                      error={err("confirmPassword")}
                    />
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => setRegStep(1)}
                      className="w-1/3 rounded-xl bg-secondary text-secondary-foreground py-2.5 text-sm font-bold uppercase tracking-wider hover:bg-secondary/80 border border-border"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-2/3 rounded-xl bg-primary py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {loading ? "Creating…" : "Sign Up"}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>

        {/* Sliding Overlay Container */}
        <div className="auth-overlay-container">
          <div
            className="auth-overlay text-white"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.22 0.006 75) 0%, oklch(0.13 0.004 75) 100%)",
            }}
          >
            {/* Overlay Panel: Left (Shown when Right Panel is Active i.e. Register mode is active) */}
            <div className="auth-overlay-panel auth-overlay-left px-12">
              <Logo className="h-14 mb-8 filter brightness-0 invert" />
              <h1 className="text-2xl font-bold tracking-tight mb-2">Already a Member?</h1>
              <p className="text-sm font-medium mb-8 text-white/75 leading-relaxed max-w-xs mx-auto">
                Welcome back! Sign in to manage your donations, track your impact, and connect with
                partners.
              </p>
              <button
                onClick={() => setIsRightPanelActive(false)}
                className="rounded-xl border-2 border-white/60 px-10 py-2.5 text-sm font-bold uppercase tracking-wider text-white transition-all hover:bg-white hover:text-foreground hover:border-white active:scale-95"
              >
                Sign In
              </button>
            </div>

            {/* Overlay Panel: Right (Shown when Left Panel is Active i.e. Login mode is active) */}
            <div className="auth-overlay-panel auth-overlay-right px-12">
              <Logo className="h-14 mb-8 filter brightness-0 invert" />
              <h1 className="text-2xl font-bold tracking-tight mb-2">New to SurplusLink?</h1>
              <p className="text-sm font-medium mb-8 text-white/75 leading-relaxed max-w-xs mx-auto">
                Join our network of Donors and NGOs to help redirect surplus food to communities in
                need.
              </p>
              <button
                onClick={() => setIsRightPanelActive(true)}
                className="rounded-xl border-2 border-white/60 px-10 py-2.5 text-sm font-bold uppercase tracking-wider text-white transition-all hover:bg-white hover:text-foreground hover:border-white active:scale-95"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
