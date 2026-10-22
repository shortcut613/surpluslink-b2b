import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";

import { AppHeader, donorNav } from "@/components/AppHeader"; // kept for type compat — unused after migration

import { donorSidebarNav } from "@/lib/nav";
import { useAuth } from "@/hooks/useAuth";
import {
  Mail,
  Phone,
  Home,
  Settings,
  HelpCircle,
  FileText,
  ShieldAlert,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { usePlacesAutocomplete } from "@/hooks/usePlacesAutocomplete";

export const Route = createFileRoute("/donor/profile")({
  component: DonorProfile,
});

function DonorProfile() {
  const navigate = useNavigate();
  const { user, displayName, initials, signOut } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "",
    phone: "",
    address: "",
    city: "",
  });

  // Target container div for modern PlaceAutocompleteElement
  const addressContainerRef = useRef<HTMLDivElement | null>(null);

  const resetForm = () => {
    if (user) {
      setFormData({
        businessName: displayName || (user.user_metadata?.business_name as string) || "",
        businessType: (user.user_metadata?.business_type as string) || "",
        phone: (user.user_metadata?.phone as string) || "",
        address: (user.user_metadata?.address as string) || "",
        city: (user.user_metadata?.city as string) || "",
      });
    }
  };

  useEffect(() => {
    resetForm();
  }, [user, displayName]);

  usePlacesAutocomplete(addressContainerRef.current, (formattedAddress, city) => {
    setFormData((prev) => ({
      ...prev,
      address: formattedAddress,
      city: city || prev.city,
    }));
  });

  const handleCancel = () => {
    resetForm();
    setIsEditing(false);
    setNeedsMfa(false);
    setMfaCode("");
    setMfaError(null);
  };

  const executeProfileSave = async () => {
    const { error: authError } = await supabase.auth.updateUser({
      data: {
        business_name: formData.businessName,
        business_type: formData.businessType,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
      },
    });
    if (authError) throw authError;

    if (user?.id) {
      const { error: dbError } = await supabase.from("donors").upsert({
        id: user.id,
        organization_name: formData.businessName,
        address: formData.address,
      });

      if (dbError) throw dbError;
    }

    setIsEditing(false);
    setNeedsMfa(false);
    setMfaCode("");
    setMfaError(null);
    toast.success("Profile updated successfully.");
  };

  async function handleSave() {
    setSaving(true);
    setMfaError(null);

    try {
      const { data: aalData, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;

      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const hasTotp = factorsData?.totp && factorsData.totp.length > 0;

      if (hasTotp && aalData?.currentLevel !== "aal2") {
        setNeedsMfa(true);
        setSaving(false);
        return;
      }

      await executeProfileSave();
    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast.error(error.message || "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const handleMfaVerificationAndSave = async () => {
    if (!mfaCode || mfaCode.length < 6) {
      setMfaError("Please enter a valid 6-digit verification code.");
      return;
    }

    setSaving(true);
    setMfaError(null);

    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp[0];

      if (!totpFactor) {
        throw new Error("No active authenticator factor found.");
      }

      const { error: challengeErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpFactor.id,
        code: mfaCode,
      });

      if (challengeErr) {
        setMfaError("Invalid verification code. Please try again.");
        setSaving(false);
        return;
      }

      await executeProfileSave();
    } catch (err: any) {
      setMfaError(err.message || "Verification failed.");
    } finally {
      setSaving(false);
    }
  };

  const donor = {
    email: user?.email || "No email provided",
    businessName: displayName || formData.businessName || "Food Donor",
    businessType: (user?.user_metadata?.business_type as string) || "Food Donor",
    phone: (user?.user_metadata?.phone as string) || "No phone provided",
    address: (user?.user_metadata?.address as string) || "No address provided",
  };

  return (
    <>
      <main className="mx-auto flex-1 w-full max-w-5xl px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Donor Profile</h1>
          <button
            onClick={() => navigate({ to: "/donor/dashboard" })}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Back to Dashboard
          </button>
        </div>

        {/* Top Profile Banner */}
        <div className="rounded-xl border bg-card p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-6 mb-6">
          <div className="h-28 w-28 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-4xl font-bold text-primary">
            {initials}
          </div>
          <div className="flex-1 text-center md:text-left space-y-3">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">{donor.businessName}</h2>
              <p className="text-muted-foreground mt-0.5">{donor.businessType}</p>
            </div>
          </div>
          <div className="w-full md:w-48 space-y-3 shrink-0 pt-2 md:pt-0">
            {!needsMfa && (
              <button
                onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
                disabled={saving}
                className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : isEditing ? "Save Profile" : "Edit Profile"}
              </button>
            )}
            {isEditing ? (
              <button
                onClick={handleCancel}
                disabled={saving}
                className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={signOut}
                className="w-full rounded-md border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/20 transition-colors"
              >
                Log Out
              </button>
            )}
          </div>
        </div>

        {/* Zero Trust Step-Up MFA Challenge Card */}
        {needsMfa && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 shrink-0 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    Zero Trust Identity Verification
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    To modify business details, please enter the 6-digit code from your
                    authenticator app.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 max-w-md">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={handleMfaVerificationAndSave}
                    disabled={saving}
                    className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? "Verifying..." : "Verify & Confirm Save"}
                  </button>
                </div>

                {mfaError && <p className="text-xs font-medium text-destructive">{mfaError}</p>}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="md:col-span-2">
            <div className="rounded-xl border bg-card shadow-sm h-full">
              <div className="px-6 py-5 border-b bg-muted/30">
                <h3 className="font-semibold text-foreground text-lg">Contact Information</h3>
              </div>

              <div className="p-6 grid gap-6 sm:grid-cols-2">
                {isEditing && (
                  <>
                    <div className="col-span-1 sm:col-span-2 space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Business Name
                      </label>
                      <input
                        type="text"
                        value={formData.businessName}
                        onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-2 space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Business Type
                      </label>
                      <input
                        type="text"
                        value={formData.businessType}
                        onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-muted/50 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Email
                    </div>
                    <div className="text-sm font-medium text-foreground">{donor.email}</div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-muted/50 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Phone
                    </div>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    ) : (
                      <div className="text-sm font-medium text-foreground">{donor.phone}</div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 col-span-1 sm:col-span-2">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-muted/50 flex items-center justify-center">
                    <Home className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Address
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <div ref={addressContainerRef} className="w-full" />
                        <input
                          type="text"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          placeholder="Or type address manually..."
                          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    ) : (
                      <div className="text-sm font-medium text-foreground">{donor.address}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-1">
            <div className="rounded-xl border bg-card overflow-hidden shadow-sm h-full">
              <div className="px-6 py-5 border-b bg-muted/30">
                <h3 className="font-semibold text-foreground text-lg">Account Links</h3>
              </div>
              <div className="divide-y">
                <button className="w-full flex items-center gap-4 px-6 py-4 text-sm font-medium hover:bg-muted/50 transition-colors text-left text-foreground">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                  Preferences
                </button>
                <button
                  onClick={() => navigate({ to: "/donor/compliance" })}
                  className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium hover:bg-muted/50 transition-colors text-left text-foreground"
                >
                  <div className="flex items-center gap-4">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    Tax Certificates
                  </div>
                </button>
                <button className="w-full flex items-center gap-4 px-6 py-4 text-sm font-medium hover:bg-muted/50 transition-colors text-left text-foreground">
                  <HelpCircle className="h-5 w-5 text-muted-foreground" />
                  Support & FAQ
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
