import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [{ title: "Privacy Policy — SurplusLink" }],
  }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="August 25, 2026">
      <p>
        At SurplusLink, we take your privacy seriously. This Privacy Policy explains how we collect,
        use, disclose, and safeguard your information when you visit our platform or use our
        services.
      </p>

      <h2>1. Information We Collect</h2>
      <p>
        We collect information that you voluntarily provide to us when you register on the platform,
        express an interest in obtaining information about us or our products, or otherwise contact
        us.
      </p>
      <ul>
        <li>
          <strong>Personal Data:</strong> Name, email address, phone number, and physical address.
        </li>
        <li>
          <strong>Organization Data:</strong> Business name, NGO registration number, and operating
          locations.
        </li>
        <li>
          <strong>Usage Data:</strong> We automatically collect certain information when you visit,
          use, or navigate the platform (e.g., IP address, browser characteristics).
        </li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <p>
        We use the information we collect or receive to facilitate the core functionality of the
        platform:
      </p>
      <ul>
        <li>To facilitate account creation and the logon process.</li>
        <li>To match surplus food donations with verified NGOs based on geographic proximity.</li>
        <li>To send you administrative information and push notifications regarding donations.</li>
        <li>To enforce our terms, conditions, and policies for business purposes.</li>
      </ul>

      <h2>3. Information Sharing</h2>
      <p>
        We only share information with your consent, to comply with laws, to provide you with
        services, to protect your rights, or to fulfill business obligations. When a donation match
        occurs, basic contact and location details are shared between the specific Donor and NGO to
        facilitate the pickup.
      </p>

      <h2>4. Data Retention</h2>
      <p>
        We will only keep your personal information for as long as it is necessary for the purposes
        set out in this privacy policy, unless a longer retention period is required or permitted by
        law (such as tax, accounting, or food safety tracking requirements).
      </p>

      <h2>5. Your Rights</h2>
      <p>
        Depending on your location, you may have the right to request access to the personal
        information we collect from you, change that information, or delete it in some
        circumstances. To request to review, update, or delete your personal information, please
        contact us.
      </p>

      <h2>6. Contact Us</h2>
      <p>
        If you have questions or comments about this notice, you may email us at{" "}
        <a href="mailto:privacy@surpluslink.org">privacy@surpluslink.org</a>.
      </p>
    </LegalLayout>
  );
}
