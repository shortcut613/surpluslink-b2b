import { createFileRoute } from "@tanstack/react-router";
import React, { useState } from "react";
import {
  CreditCard,
  Building2,
  Plus,
  AlertCircle,
  Lock,
  CheckCircle2,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import CapitecPng from "../assets/images/Capitec.png";
import StandardBankPng from "../assets/images/Standard_Bank.png";
import FnbPng from "../assets/images/FNB.png";
import AbsaPng from "../assets/images/Absa.png";
import MastercardPng from "../assets/images/Mastercard.png";
import VisaPng from "../assets/images/Visa.png";
import DiscoveryPng from "../assets/images/Discovery.png";
import InvestecPng from "../assets/images/Investec.png";
import NedbankPng from "../assets/images/Nedbank.png";
import TymebankPng from "../assets/images/tymebank.png";

export const Route = createFileRoute("/donor/funds")({
  component: DonorFundsComponent,
});

// --- Payment Method Brand SVG Logos ---

function MastercardLogo({ className = "h-5 w-auto" }: { className?: string }) {
  return <img src={MastercardPng} alt="Mastercard" className={className} />;
}

function VisaLogo({ className = "h-5 w-auto" }: { className?: string }) {
  return <img src={VisaPng} alt="Visa" className={className} />;
}

function CapitecLogo({ className = "h-5 w-auto" }: { className?: string }) {
  return <img src={CapitecPng} alt="Capitec" className={className} />;
}

function StandardBankLogo({ className = "h-5 w-auto" }: { className?: string }) {
  return <img src={StandardBankPng} alt="Standard Bank" className={className} />;
}

function FnbLogo({ className = "h-5 w-auto" }: { className?: string }) {
  return <img src={FnbPng} alt="FNB" className={className} />;
}

function AbsaLogo({ className = "h-5 w-auto" }: { className?: string }) {
  return <img src={AbsaPng} alt="Absa" className={className} />;
}

function DiscoveryLogo({ className = "h-5 w-auto" }: { className?: string }) {
  return <img src={DiscoveryPng} alt="Discovery Bank" className={className} />;
}

function InvestecLogo({ className = "h-5 w-auto" }: { className?: string }) {
  return <img src={InvestecPng} alt="Investec" className={className} />;
}

function NedbankLogo({ className = "h-5 w-auto" }: { className?: string }) {
  return <img src={NedbankPng} alt="Nedbank" className={className} />;
}

function TymebankLogo({ className = "h-5 w-auto" }: { className?: string }) {
  return <img src={TymebankPng} alt="GoTyme Bank" className={className} />;
}

function DonorFundsComponent() {
  const [selectedAmount, setSelectedAmount] = useState<number | string>(100);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [billingAddress, setBillingAddress] = useState({
    addressLine1: "",
    city: "",
    postalCode: "",
    country: "South Africa",
  });
  const [emailAddress, setEmailAddress] = useState("");
  const [wantsSection18A, setWantsSection18A] = useState(false);
  const [note, setNote] = useState("");
  const [showNoteField, setShowNoteField] = useState(false);

  // --- Payment Method States ---
  const [paymentType, setPaymentType] = useState<"card" | "eft">("card");
  const [selectedSavedId, setSelectedSavedId] = useState<string>("pm-1");
  const [selectedBank, setSelectedBank] = useState<string>("capitec");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [receiptData, setReceiptData] = useState<{
    amount: number;
    methodText: string;
    reference: string;
    section18A: boolean;
  } | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // New Card Fields State
  const [cardHolder, setCardHolder] = useState<string>("");
  const [cardNumber, setCardNumber] = useState<string>("");
  const [cardExpiry, setCardExpiry] = useState<string>("");
  const [cardCvv, setCardCvv] = useState<string>("");

  const presets = [50, 100, 250, 500, 1000];

  const savedMethods = [
    {
      id: "pm-1",
      title: "Mastercard ending in 4821",
      subtitle: "Expires 09/28",
      brand: "mastercard",
      isDefault: true,
    },
    {
      id: "pm-2",
      title: "Visa ending in 1092",
      subtitle: "Expires 11/26",
      brand: "visa",
    },
  ];

  const bankOptions = [
    { id: "capitec", name: "Capitec Bank", icon: CapitecLogo },
    { id: "fnb", name: "First National Bank (FNB)", icon: FnbLogo },
    { id: "standardbank", name: "Standard Bank", icon: StandardBankLogo },
    { id: "absa", name: "Absa Bank", icon: AbsaLogo },
    { id: "nedbank", name: "Nedbank", icon: NedbankLogo },
    { id: "discovery", name: "Discovery Bank", icon: DiscoveryLogo },
    { id: "investec", name: "Investec", icon: InvestecLogo },
    { id: "gotyme", name: "GoTyme Bank", icon: TymebankLogo },
  ];

  const handlePresetSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomAmount(val);
    setSelectedAmount(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCustom = parseFloat(customAmount);
    const finalAmount = !isNaN(parsedCustom) ? parsedCustom : Number(selectedAmount) || 0;

    if (finalAmount <= 0) return;

    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      const selectedBankName = bankOptions.find((b) => b.id === selectedBank)?.name;
      const methodText =
        paymentType === "eft"
          ? `Instant EFT (${selectedBankName})`
          : selectedSavedId === "new-card"
            ? `New Card (ending in ${cardNumber.slice(-4) || "****"})`
            : savedMethods.find((m) => m.id === selectedSavedId)?.title || "Card Payment";

      const reference = `SL-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      console.log("Submitting Community Wallet Logistics Contribution:", {
        amount: finalAmount,
        paymentType,
        paymentDetails: methodText,
        billingAddress,
        emailAddress,
        wantsSection18A,
        note,
        reference,
      });

      setReceiptData({
        amount: finalAmount,
        methodText,
        reference,
        section18A: wantsSection18A,
      });
      setIsReceiptOpen(true);
      toast.success("Contribution received!", {
        description: `R${finalAmount.toFixed(2)} allocated to rescue logistics.`,
      });
    }, 1000);
  };

  const renderCardBrand = (brand: string) => {
    switch (brand) {
      case "mastercard":
        return <MastercardLogo />;
      case "visa":
        return <VisaLogo />;
      default:
        return <CreditCard className="h-5 w-5 text-slate-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Header Title Section */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-2">
          Community Wallet
        </h1>
        <p className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest">
          Fund the logistics that rescue the food
        </p>
      </div>

      {/* Main Form Card */}
      <div className="max-w-4xl mx-auto bg-background rounded-3xl shadow-sm border border-border/50 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-8">
          {/* Amount Selection Section */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-2">
            <div className="w-full md:w-auto text-center md:text-left">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Choose an Amount
              </label>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                {presets.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handlePresetSelect(amt)}
                    className={`px-5 py-3 rounded-xl border text-sm font-semibold transition-all ${
                      selectedAmount === amt && !customAmount
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border bg-secondary/30 text-slate-700 hover:bg-secondary/50"
                    }`}
                  >
                    R{amt}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs font-bold text-slate-400 uppercase">OR</div>

            <div className="w-full md:w-64">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 text-center md:text-left">
                Enter Your Own
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <span className="text-muted-foreground font-bold text-sm">R</span>
                </div>
                <input
                  type="number"
                  min="1"
                  placeholder="0.00"
                  value={customAmount}
                  onChange={handleCustomAmountChange}
                  className="w-full rounded-xl border border-border bg-secondary/30 py-3 pl-9 pr-4 text-sm font-semibold text-foreground focus:border-primary focus:bg-background focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Details Inner Box */}
          <div className="rounded-2xl border border-border/80 bg-secondary/30/30 p-6 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Billing Address Column */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  Billing Address{" "}
                  <span className="text-[10px] font-normal text-slate-400 uppercase tracking-wider">
                    (Required for Tax Receipt)
                  </span>
                </h3>

                <div>
                  <input
                    type="text"
                    required
                    placeholder="Address Line 1"
                    value={billingAddress.addressLine1}
                    onChange={(e) =>
                      setBillingAddress({ ...billingAddress, addressLine1: e.target.value })
                    }
                    className="w-full rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="City"
                    value={billingAddress.city}
                    onChange={(e) => setBillingAddress({ ...billingAddress, city: e.target.value })}
                    className="w-full rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background focus:outline-none"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Postal Code"
                    value={billingAddress.postalCode}
                    onChange={(e) =>
                      setBillingAddress({ ...billingAddress, postalCode: e.target.value })
                    }
                    className="w-full rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background focus:outline-none"
                  />
                </div>

                <div>
                  <select
                    value={billingAddress.country}
                    onChange={(e) =>
                      setBillingAddress({ ...billingAddress, country: e.target.value })
                    }
                    className="w-full rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-foreground focus:border-primary focus:bg-background focus:outline-none"
                  >
                    <option value="South Africa">South Africa</option>
                  </select>
                </div>
              </div>

              {/* Contact Details & Section 18A Column */}
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    Contact Details{" "}
                    <span className="text-[10px] font-normal text-slate-400 uppercase tracking-wider">
                      (Required)
                    </span>
                  </h3>
                  <input
                    type="email"
                    required
                    placeholder="Email Address"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="w-full rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background focus:outline-none"
                  />
                </div>

                <div className="pt-2">
                  <h3 className="text-sm font-bold text-slate-900 mb-2">Section 18A Certificate</h3>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wantsSection18A}
                      onChange={(e) => setWantsSection18A(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    />
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      I would like to receive a Section 18A tax certificate for this donation. By
                      ticking this box, I confirm that the details provided are correct for tax
                      purposes.
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method Selector Box */}
          <div className="rounded-2xl border border-border/80 bg-secondary/30/30 p-6 sm:p-8 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              Select Payment Method
            </h3>

            {/* Type Switcher */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentType("card")}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition-all ${
                  paymentType === "card"
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <CreditCard className="h-4 w-4" />
                <span>Credit / Debit Card</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentType("eft")}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition-all ${
                  paymentType === "eft"
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <Building2 className="h-4 w-4" />
                <span>Instant EFT</span>
              </button>
            </div>

            {/* Card Method Details */}
            {paymentType === "card" ? (
              <div className="space-y-3 pt-2">
                <div className="space-y-2">
                  {savedMethods.map((method) => (
                    <label
                      key={method.id}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all ${
                        selectedSavedId === method.id
                          ? "border-primary bg-background ring-2 ring-primary/10"
                          : "border-border bg-background hover:border-input"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="savedMethod"
                          value={method.id}
                          checked={selectedSavedId === method.id}
                          onChange={(e) => setSelectedSavedId(e.target.value)}
                          className="h-4 w-4 text-primary focus:ring-primary"
                        />
                        {renderCardBrand(method.brand)}
                        <div>
                          <p className="text-xs font-bold text-foreground">{method.title}</p>
                          <p className="text-[11px] text-slate-400">{method.subtitle}</p>
                        </div>
                      </div>
                      {method.isDefault && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                          Default
                        </span>
                      )}
                    </label>
                  ))}

                  <label
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all ${
                      selectedSavedId === "new-card"
                        ? "border-primary bg-background ring-2 ring-primary/10"
                        : "border-border bg-background hover:border-input"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="savedMethod"
                        value="new-card"
                        checked={selectedSavedId === "new-card"}
                        onChange={(e) => setSelectedSavedId(e.target.value)}
                        className="h-4 w-4 text-primary focus:ring-primary"
                      />
                      <div className="flex h-5 w-8 items-center justify-center rounded border border-dashed border-input">
                        <Plus className="h-3 w-3 text-slate-400" />
                      </div>
                      <span className="text-xs font-bold text-foreground">
                        Use a new credit or debit card
                      </span>
                    </div>
                  </label>
                </div>

                {/* Inline Form for New Card */}
                {selectedSavedId === "new-card" && (
                  <div className="mt-3 space-y-3 rounded-xl border border-border/80 bg-background p-4">
                    <div>
                      <input
                        type="text"
                        placeholder="Cardholder Name"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                        required={selectedSavedId === "new-card"}
                        className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background focus:outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Card Number (e.g. 4111 •••• •••• 1092)"
                        maxLength={19}
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        required={selectedSavedId === "new-card"}
                        className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="MM/YY"
                        maxLength={5}
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        required={selectedSavedId === "new-card"}
                        className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background focus:outline-none"
                      />
                      <input
                        type="password"
                        placeholder="CVV"
                        maxLength={4}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        required={selectedSavedId === "new-card"}
                        className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* EFT Option Details */
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {bankOptions.map((bank) => {
                    const BankIcon = bank.icon;
                    return (
                      <button
                        key={bank.id}
                        type="button"
                        onClick={() => setSelectedBank(bank.id)}
                        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                          selectedBank === bank.id
                            ? "border-primary bg-background ring-2 ring-primary/10"
                            : "border-border bg-background hover:border-input"
                        }`}
                      >
                        <BankIcon className="h-5 w-auto" />
                        <span className="text-[11px] font-bold text-slate-700">{bank.name}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-amber-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-[11px]">
                    Direct clearing to funding wallet for immediate logistics dispatch.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Optional Note Field */}
          {showNoteField && (
            <div>
              <textarea
                rows={3}
                placeholder="Add your note here..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl border border-border bg-secondary/30 p-4 text-sm text-foreground focus:border-primary focus:bg-background focus:outline-none"
              />
            </div>
          )}

          {/* Action Buttons Line */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border/60">
            <button
              type="button"
              onClick={() => setShowNoteField(!showNoteField)}
              className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-muted-foreground font-bold text-xs uppercase tracking-wider transition-all"
            >
              {showNoteField ? "Remove Note" : "Add Note (Optional)"}
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-12 py-3.5 rounded-xl bg-[#737bb9] hover:bg-[#626ab0] text-white font-bold text-sm tracking-wider uppercase shadow-md transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Processing...</span>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Submit Logistics Contribution</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Bottom Disclaimer Banner */}
        <div className="bg-slate-100/70 border-t border-border/60 px-6 sm:px-10 py-6 flex items-start sm:items-center gap-4">
          <div className="text-[#3b4386] shrink-0 pt-0.5 sm:pt-0">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2"
              />
            </svg>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            All donations go directly towards funding operational deliveries for our verified NGOs
            and keeping the SurplusLink platform running. Your support ensures that perfectly good
            surplus food reaches those who need it most, without being hindered by logistical costs.
          </p>
        </div>
      </div>

      {/* Payment Confirmation Receipt Dialog */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-md p-6 rounded-2xl">
          <DialogHeader className="text-center sm:text-center pb-2 border-b">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold">Contribution Received!</DialogTitle>
            <DialogDescription className="text-sm">
              Thank you for funding rescue logistics. Your contribution is powering delivery vans
              across our network.
            </DialogDescription>
          </DialogHeader>

          {receiptData && (
            <div className="py-4 space-y-3 text-sm">
              <div className="rounded-xl border bg-muted/40 p-4 space-y-2.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Amount Contributed</span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    R{receiptData.amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-border/50 pt-2 text-xs">
                  <span className="text-muted-foreground">Payment Method</span>
                  <span className="font-medium text-foreground">{receiptData.methodText}</span>
                </div>
                <div className="flex justify-between items-center border-t border-border/50 pt-2 text-xs">
                  <span className="text-muted-foreground">Reference Number</span>
                  <span className="font-mono font-bold text-foreground">
                    {receiptData.reference}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-border/50 pt-2 text-xs">
                  <span className="text-muted-foreground">Section 18A Tax Receipt</span>
                  <span className="font-semibold text-primary">
                    {receiptData.section18A ? "Requested (Emailed automatically)" : "Not requested"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setIsReceiptOpen(false)}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
