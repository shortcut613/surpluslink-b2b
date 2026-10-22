import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [{ title: "Cookie Policy — SurplusLink" }],
  }),
  component: CookiePolicy,
});

function CookiePolicy() {
  return (
    <LegalLayout title="Cookie Policy" lastUpdated="August 25, 2026">
      <p>
        This Cookie Policy explains how SurplusLink ("we", "us", or "our") uses cookies and similar
        technologies to recognize you when you visit our platform. It explains what these
        technologies are and why we use them, as well as your rights to control our use of them.
      </p>

      <h2>1. What are cookies?</h2>
      <p>
        Cookies are small data files that are placed on your computer or mobile device when you
        visit a website. Cookies are widely used by website owners in order to make their websites
        work, or to work more efficiently, as well as to provide reporting information.
      </p>

      <h2>2. Why do we use cookies?</h2>
      <p>
        We use first-party cookies for several reasons. Some cookies are required for technical
        reasons in order for our platform to operate, and we refer to these as "essential" or
        "strictly necessary" cookies. For example, we use cookies to keep you logged in securely.
      </p>

      <h2>3. Types of Cookies We Use</h2>
      <ul>
        <li>
          <strong>Authentication & Session Cookies:</strong> We use Supabase to manage user
          sessions. Tokens and session identifiers are stored in cookies (or local storage) to keep
          you securely logged in as you navigate between pages. These are strictly necessary.
        </li>
        <li>
          <strong>UI State Cookies:</strong> We may store small preferences (like your dark/light
          mode preference or sidebar collapse state) to prevent flashing during server-side
          rendering.
        </li>
      </ul>

      <h2>4. What about tracking and third-party cookies?</h2>
      <p>
        SurplusLink is committed to privacy. We do not use intrusive third-party tracking cookies or
        advertising networks. Any third-party scripts (such as Google Maps) are used strictly for
        functionality (e.g., location autocomplete) and do not track you for advertising purposes on
        our behalf.
      </p>

      <h2>5. How can I control cookies?</h2>
      <p>
        You have the right to decide whether to accept or reject cookies. Because the cookies we use
        are strictly necessary to deliver the platform to you, you cannot refuse them without
        breaking core functionality (such as logging in). You can, however, block or delete them by
        changing your browser settings, but you will not be able to use the authenticated features
        of SurplusLink.
      </p>

      <h2>6. Updates to this policy</h2>
      <p>
        We may update this Cookie Policy from time to time in order to reflect, for example, changes
        to the cookies we use or for other operational, legal, or regulatory reasons. Please revisit
        this Cookie Policy regularly to stay informed.
      </p>
    </LegalLayout>
  );
}
