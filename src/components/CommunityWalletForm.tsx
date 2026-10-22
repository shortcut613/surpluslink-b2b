import React, { useState, useEffect } from "react";
import { CheckCircle2, HeartHandshake } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePlacesAutocomplete } from "@/hooks/usePlacesAutocomplete";

const PRESETS = [50, 100, 250, 500, 1000];

export function CommunityWalletForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();

  const [amount, setAmount] = useState<number | "">("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [taxCert, setTaxCert] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
      setAddress((user.user_metadata?.address as string) || "");
      setCity((user.user_metadata?.city as string) || "");
    }
  }, [user]);

  const [addressInput, setAddressInput] = useState<HTMLInputElement | null>(null);

  usePlacesAutocomplete(addressInput, (formattedAddress, detectedCity) => {
    setAddress(formattedAddress);
    if (detectedCity) setCity(detectedCity);
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;

    setIsProcessing(true);
    setSuccessMessage(null);

    // Simulate API call
    setTimeout(() => {
      setIsProcessing(false);
      setSuccessMessage(
        `Thank you! Your contribution of R${Number(amount).toFixed(2)} has been successfully added to the Community Wallet.`,
      );
      setAmount("");
      if (onSuccess) {
        setTimeout(onSuccess, 3000);
      }
    }, 1500);
  };

  return (
    <>
      {successMessage && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-success/25 bg-success/10 p-4 text-success shadow-sm animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-success" />
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}

      <div className="glass-lg rounded-3xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
        <form onSubmit={handleSubmit}>
          <div className="p-8 md:p-12">
            {/* Amount Selection */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-10">
              <div className="flex-1 w-full">
                <h3 className="text-xs font-bold text-center mb-4 text-muted-foreground uppercase tracking-widest">
                  Choose an amount
                </h3>
                <div className="flex flex-wrap gap-2 justify-center">
                  {PRESETS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmount(val)}
                      className={`border px-4 py-2.5 rounded-md text-sm font-semibold transition-all duration-200 ${
                        amount === val
                          ? "bg-primary border-primary text-primary-foreground shadow-sm scale-105"
                          : "bg-background text-foreground hover:border-primary hover:text-primary"
                      }`}
                    >
                      R{val}
                    </button>
                  ))}
                </div>
              </div>

              <div className="hidden md:block text-[10px] font-bold text-muted-foreground uppercase">
                OR
              </div>
              <div className="md:hidden w-full flex items-center gap-4">
                <div className="h-px bg-border flex-1"></div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase">OR</div>
                <div className="h-px bg-border flex-1"></div>
              </div>

              <div className="flex-1 w-full">
                <h3 className="text-xs font-bold text-center mb-4 text-muted-foreground uppercase tracking-widest">
                  Enter your own
                </h3>
                <div className="relative max-w-[200px] mx-auto">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <span className="text-sm font-bold text-muted-foreground">R</span>
                  </div>
                  <input
                    type="number"
                    min="10"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
                    placeholder="0.00"
                    className={`w-full border rounded-md pl-8 pr-4 py-2.5 text-center font-medium focus:outline-none focus:ring-2 focus:border-primary transition-colors ${
                      amount !== "" && !PRESETS.includes(Number(amount))
                        ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                        : "bg-background border-input"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Details Section */}
            <div className="bg-muted/30 p-6 md:p-8 rounded-xl border border-border grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Left: Address */}
              <div>
                <h3 className="text-sm font-bold mb-4 text-foreground flex items-baseline gap-2">
                  Billing Address
                  <span className="text-[9px] font-semibold text-muted-foreground tracking-wider">
                    (REQUIRED FOR TAX RECEIPT)
                  </span>
                </h3>
                <div className="space-y-3">
                  <input
                    ref={setAddressInput}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Address Line 1"
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      value={postal}
                      onChange={(e) => setPostal(e.target.value)}
                      placeholder="Postal Code"
                      className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    <option>South Africa</option>
                  </select>
                </div>
              </div>

              {/* Right: Email & Options */}
              <div>
                <h3 className="text-sm font-bold mb-4 text-foreground flex items-baseline gap-2">
                  Contact Details
                  <span className="text-[9px] font-semibold text-muted-foreground tracking-wider">
                    (REQUIRED)
                  </span>
                </h3>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  required
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary mb-6"
                />

                <h3 className="text-sm font-bold mb-4 text-foreground">Section 18A Certificate</h3>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      checked={taxCert}
                      onChange={(e) => setTaxCert(e.target.checked)}
                      className="w-4 h-4 rounded border-input text-primary focus:ring-primary transition-colors cursor-pointer"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
                    I would like to receive a Section 18A tax certificate for this donation. By
                    ticking this box, I confirm that the details provided are correct for tax
                    purposes.
                  </span>
                </label>
              </div>
            </div>

            {/* Submit Area */}
            <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-6 border-t pt-8">
              <button
                type="button"
                className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors bg-secondary px-5 py-2.5 rounded-md w-full md:w-auto"
              >
                Add Note (Optional)
              </button>
              <button
                type="submit"
                disabled={isProcessing || !amount || Number(amount) <= 0}
                className="w-full md:w-48 bg-primary text-primary-foreground font-bold tracking-widest uppercase py-3.5 rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {isProcessing ? "Processing..." : "Submit"}
              </button>
            </div>
          </div>

          {/* Footer Note */}
          <div className="bg-muted/50 px-8 py-5 border-t">
            <div className="flex items-start gap-3 justify-center">
              <HeartHandshake className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed max-w-2xl">
                All donations go directly towards funding operational deliveries for our verified
                NGOs and keeping the SurplusLink platform running. Your support ensures that
                perfectly good surplus food reaches those who need it most, without being hindered
                by logistical costs.
              </p>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
