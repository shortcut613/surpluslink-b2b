import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";

import { ngoSidebarNav } from "@/lib/nav";
import { useNgoVerification } from "@/hooks/useNgoVerification";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { UploadCloud, CheckCircle, FileText, Clock, Check } from "lucide-react";

export const Route = createFileRoute("/ngo/verification")({
  head: () => ({ meta: [{ title: "Verification Status — SurplusLink" }] }),
  component: NgoVerification,
});

function NgoVerification() {
  const { isAuthorized, isVerified, isChecking, user } = useNgoVerification();
  const [hasUploaded, setHasUploaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    async function checkExistingUpload() {
      // 1. Check local storage
      if (localStorage.getItem("ngo_documents_uploaded") === "true") {
        setHasUploaded(true);
      }
      // 2. Check auth metadata
      if (user?.user_metadata?.documents_uploaded || user?.user_metadata?.document_url) {
        setHasUploaded(true);
      }
      // 3. Check public.ngos
      if (user?.id) {
        try {
          const { data } = await supabase
            .from("ngos")
            .select("document_url")
            .eq("id", user.id)
            .maybeSingle();
          if (data?.document_url) {
            setHasUploaded(true);
          }
        } catch (err) {
          console.warn("Could not check document_url on ngos:", err);
        }
      }
    }

    checkExistingUpload();
  }, [user]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthorized) return null;

  const orgName = user?.user_metadata?.organization_name || "Organisation";
  const initials = orgName.slice(0, 2).toUpperCase();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !user) return;

    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error("File exceeds maximum allowed size of 5MB.");
      return;
    }

    setIsUploading(true);
    try {
      let resolvedUrl: string | null = null;
      const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${user.id}/${Date.now()}-${safeFileName}`;

      // 1. Attempt upload to Supabase Storage bucket "ngo-documents"
      try {
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("ngo-documents")
          .upload(filePath, selectedFile, {
            cacheControl: "3600",
            upsert: true,
          });

        if (!uploadError && uploadData) {
          const { data: publicUrlData } = supabase.storage
            .from("ngo-documents")
            .getPublicUrl(filePath);
          if (publicUrlData?.publicUrl) {
            resolvedUrl = publicUrlData.publicUrl;
          }
        } else {
          console.warn(
            "Storage upload failed or bucket absent, falling back to base64 Data URL:",
            uploadError,
          );
        }
      } catch (storageErr) {
        console.warn("Storage upload error, using Data URL fallback:", storageErr);
      }

      // 2. If storage upload did not yield a URL, convert to Base64 Data URL
      if (!resolvedUrl) {
        resolvedUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(selectedFile);
        });
      }

      // 3. Save document_url to public.ngos
      const { error: dbError } = await supabase
        .from("ngos")
        .update({
          document_url: resolvedUrl,
        })
        .eq("id", user.id);

      if (dbError) {
        console.warn("Could not update document_url on ngos table:", dbError);
      }

      // 4. Save to auth user metadata
      await supabase.auth.updateUser({
        data: {
          document_url: resolvedUrl,
          document_name: selectedFile.name,
          documents_uploaded: true,
        },
      });

      // 5. Update local state and storage
      localStorage.setItem("ngo_documents_uploaded", "true");
      setHasUploaded(true);
      toast.success("Registration documents uploaded successfully!", {
        description: "Your documents are now queued for administrator review.",
      });
    } catch (err: any) {
      console.error("Document upload failed:", err);
      toast.error("Failed to upload document", {
        description: err.message || "Please try again.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Determine current active step index:
  // Step 1: Submit Documents
  // Step 2: Under Review
  // Step 3: Account Approved
  const currentStep = isVerified ? 3 : hasUploaded ? 2 : 1;

  const steps = [
    {
      step: 1,
      title: "Submit Documents",
      desc: "Upload official NPO/NGO registration certificates.",
    },
    {
      step: 2,
      title: "Under Review",
      desc: "Our team reviews your application (takes 3–7 working days).",
    },
    {
      step: 3,
      title: "Account Approved",
      desc: "Receive confirmation and start claiming surplus donations.",
    },
  ];

  return (
    <>
      <main className="flex-1 w-full flex items-center justify-center p-6">
        <div className="w-full max-w-xl">
          <div className="mb-8">
            <Link
              to="/ngo/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block transition-colors"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl font-black tracking-tight mt-2">Verification Status</h1>
            <p className="mt-2 text-muted-foreground text-sm">
              SurplusLink requires all NGO partners to be independently verified to ensure food
              safety and regulatory compliance.
            </p>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            {isVerified ? (
              <div className="p-8 text-center flex flex-col items-center">
                <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold mb-2">Account Fully Verified</h2>
                <p className="text-muted-foreground text-sm max-w-sm">
                  Your organization has been successfully verified. You have full access to claim
                  donations on the SurplusLink platform.
                </p>
              </div>
            ) : hasUploaded ? (
              <div className="p-8 text-center flex flex-col items-center">
                <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6 border border-primary/20">
                  <Clock className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold mb-2">Documents Received</h2>
                <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
                  Thank you for submitting your registration documents. Our team is currently
                  reviewing your application.
                </p>
              </div>
            ) : (
              <div className="p-8">
                <div className="flex items-start gap-4 mb-8">
                  <div className="h-10 w-10 bg-warning/10 text-warning-foreground rounded-full flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Action Required</h2>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      Please upload your official NPO/NGO registration certificate or equivalent
                      documentation to prove your organization is registered.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleUpload}>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:bg-muted/30 transition-colors">
                    <input
                      type="file"
                      id="document-upload"
                      className="hidden"
                      onChange={handleFileChange}
                      accept=".pdf,.png,.jpg,.jpeg"
                    />
                    <label
                      htmlFor="document-upload"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <UploadCloud
                        className={`h-10 w-10 mb-4 ${selectedFile ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <span className="text-sm font-semibold mb-1">
                        {selectedFile ? selectedFile.name : "Click to select a file"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {selectedFile ? "Click to change file" : "PDF, PNG, or JPG up to 5MB"}
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={!selectedFile || isUploading}
                    className="mt-6 w-full bg-primary text-primary-foreground font-bold py-3 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-xs"
                  >
                    {isUploading ? "Uploading..." : "Submit Documents"}
                  </button>
                </form>
              </div>
            )}

            {/* What Happens Next Steps */}
            <div className="border-t bg-muted/30 p-6 md:p-8">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-6">
                What Happens Next
              </h3>

              <div className="space-y-6">
                {steps.map((item) => {
                  const isCompleted = currentStep > item.step;
                  const isCurrent = currentStep === item.step;

                  return (
                    <div key={item.step} className="flex items-start gap-4">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                          isCompleted
                            ? "bg-emerald-500 text-white"
                            : isCurrent
                              ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                              : "bg-muted border text-muted-foreground"
                        }`}
                      >
                        {isCompleted ? <Check className="h-4 w-4" /> : item.step}
                      </div>

                      <div className="pt-0.5">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm font-semibold ${
                              isCurrent || isCompleted ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {item.title}
                          </p>
                          {isCurrent && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                              Current Step
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
