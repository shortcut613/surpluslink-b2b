import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [{ title: "Terms of Service — SurplusLink" }],
  }),
  component: TermsOfService,
});

function TermsOfService() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="August 25, 2026">
      <p>
        Welcome to SurplusLink. These Terms of Service ("Terms") govern your access to and use of
        the SurplusLink platform. Please read these Terms carefully before using our services.
      </p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using the platform, you agree to be bound by these Terms and our Privacy
        Policy. If you do not agree to these Terms, you may not access or use the platform.
      </p>

      <h2>2. Eligibility and Verification</h2>
      <p>
        <strong>For Donors:</strong> You represent that you are authorized to donate food on behalf
        of your business and that all donated items comply with local food safety regulations.
      </p>
      <p>
        <strong>For NGOs:</strong> You represent that you are a registered non-governmental or
        non-profit organization. You agree to submit to our verification process before claiming
        donations.
      </p>

      <h2>3. Platform Role</h2>
      <p>
        SurplusLink provides a technological bridge to facilitate communication between food donors
        and NGOs. We do not own, prepare, transport, or take possession of any food items listed on
        the platform.
      </p>

      <h2>4. Food Safety and Liability Waiver</h2>
      <p>
        Donors agree to only list food that has been stored and prepared in accordance with health
        department standards. NGOs agree to inspect all food upon collection and accept it "as is."
      </p>
      <p>
        To the maximum extent permitted by law, SurplusLink disclaims any and all liability for
        illness, injury, or damages arising from the consumption or handling of food donated through
        the platform. Donors and NGOs engage in transactions at their own risk.
      </p>

      <h2>5. Prohibited Conduct</h2>
      <p>You agree not to use the platform to:</p>
      <ul>
        <li>List spoiled, contaminated, or unsafe food items.</li>
        <li>Resell or attempt to profit directly from food acquired through the platform.</li>
        <li>Provide false or misleading registration information.</li>
        <li>Harass, abuse, or harm other users.</li>
      </ul>

      <h2>6. Termination</h2>
      <p>
        We may terminate or suspend your account and bar access to the platform immediately, without
        prior notice or liability, under our sole discretion, for any reason whatsoever and without
        limitation, including but not limited to a breach of the Terms.
      </p>

      <h2>7. Changes to Terms</h2>
      <p>
        We reserve the right to modify or replace these Terms at any time. We will provide notice of
        significant changes. Your continued use of the platform following the posting of any changes
        constitutes acceptance of those changes.
      </p>
    </LegalLayout>
  );
}
