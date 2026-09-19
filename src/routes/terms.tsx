import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { SITE_CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: `Terms of Service — ${SITE_NAME}` },
      { name: "description", content: `The terms that govern your use of ${SITE_NAME}.` },
    ],
  }),
  component: TermsOfService,
});

function TermsOfService() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        By creating an account or using {SITE_NAME} (the &quot;Service&quot;) you agree to these
        terms. If you do not agree, please do not use the Service.
      </p>

      <h2>What the Service is</h2>
      <p>
        {SITE_NAME} is a personal music organiser. It reads the library of a Spotify account you
        connect and plays matching tracks through YouTube&apos;s public embedded player. It does not
        host, download, copy or redistribute any audio.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must provide accurate information and keep your password confidential.</li>
        <li>You are responsible for all activity that happens under your account.</li>
        <li>You must be old enough to hold a Spotify account in your country.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service in a way that violates any law or the terms of Spotify or YouTube.</li>
        <li>Attempt to circumvent rate limits, quotas or access controls.</li>
        <li>Reverse engineer, scrape or disrupt the Service or its infrastructure.</li>
        <li>
          Upload content you do not have the right to use (for example, playlist cover images).
        </li>
      </ul>

      <h2>Third-party platforms</h2>
      <p>
        Spotify and YouTube are independent services with their own terms. Your use of them through{" "}
        {SITE_NAME} is governed by the{" "}
        <a
          href="https://www.spotify.com/legal/end-user-agreement/"
          target="_blank"
          rel="noreferrer noopener"
        >
          Spotify Terms of Use
        </a>{" "}
        and the{" "}
        <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer noopener">
          YouTube Terms of Service
        </a>
        . {SITE_NAME} is not affiliated with, endorsed by or sponsored by Spotify or YouTube.
      </p>

      <h2>Availability</h2>
      <p>
        The Service depends on third-party APIs with daily quotas. Playback or syncing may be
        temporarily unavailable when those quotas are exhausted. We may change, suspend or
        discontinue the Service at any time.
      </p>

      <h2>Disclaimer and limitation of liability</h2>
      <p>
        The Service is provided &quot;as is&quot; without warranties of any kind. To the fullest
        extent permitted by law, we are not liable for any indirect, incidental or consequential
        damages arising from your use of the Service.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the Service at any time and request deletion of your account. We may
        suspend or terminate accounts that violate these terms.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms from time to time. The date at the top of this page reflects the
        latest version. Continued use after a change means you accept the updated terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Email <a href={`mailto:${SITE_CONTACT_EMAIL}`}>{SITE_CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
