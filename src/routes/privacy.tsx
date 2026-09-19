import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { SITE_CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: `Privacy Policy — ${SITE_NAME}` },
      { name: "description", content: `How ${SITE_NAME} collects, uses and protects your data.` },
    ],
  }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        {SITE_NAME} lets you connect a Spotify account, import your library, and play those tracks
        through an embedded YouTube player. This policy explains what data the service handles and
        why. It is written to reflect exactly what the application does.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details.</strong> Your email address, a display name, and a password. The
          password is hashed by our authentication provider and is never visible to us.
        </li>
        <li>
          <strong>Spotify connection.</strong> When you link Spotify, we store the OAuth access and
          refresh tokens Spotify issues, along with your Spotify user ID and display name. Tokens
          are kept server-side only and are used solely to read your library on your behalf.
        </li>
        <li>
          <strong>Library data.</strong> Names of your playlists and tracks, artist and album names,
          album art URLs, durations, and Spotify track IDs. If you upload a playlist cover, that
          image is stored too.
        </li>
        <li>
          <strong>YouTube lookups.</strong> To play a track we search YouTube for a matching video
          and cache the resulting video ID next to the track.
        </li>
      </ul>
      <p>
        We do not run analytics, advertising, or tracking scripts, and we do not sell or share your
        data with third parties for their own purposes.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To sign you in and keep your session active.</li>
        <li>To import and display your Spotify library.</li>
        <li>To find and play the matching YouTube video for each track.</li>
        <li>To troubleshoot errors when something goes wrong.</li>
      </ul>

      <h2>Cookies and browser storage</h2>
      <p>
        {SITE_NAME} itself stores only what is essential: your authentication session and the fact
        that you dismissed the storage notice. Both live in your browser&apos;s local storage and
        can be cleared at any time from your browser settings.
      </p>
      <p>
        Playback uses YouTube&apos;s embedded player in privacy-enhanced mode (
        <code>youtube-nocookie.com</code>). Even so, YouTube and Google may set cookies or collect
        usage data when a video plays, under the{" "}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer noopener">
          Google Privacy Policy
        </a>
        .
      </p>

      <h2>Third-party services</h2>
      <ul>
        <li>
          <strong>Supabase</strong> — authentication, database and file storage. Data is encrypted
          at rest and every table is protected by row-level security so you can only ever read your
          own rows.
        </li>
        <li>
          <strong>Spotify Web API</strong> — read-only access to your library. We request only the
          scopes needed to read your profile, saved tracks and playlists; we never modify your
          Spotify account.
        </li>
        <li>
          <strong>YouTube Data API and IFrame Player</strong> — searching for and playing videos.
          Use of the YouTube API is subject to the{" "}
          <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer noopener">
            YouTube Terms of Service
          </a>
          .
        </li>
        <li>
          <strong>Cloudflare</strong> — hosting for the application server.
        </li>
      </ul>

      <h2>Retention and deletion</h2>
      <p>
        Your data is kept for as long as your account exists. Disconnecting Spotify from the
        Settings page deletes the stored tokens immediately. To delete your account and all
        associated data, email <a href={`mailto:${SITE_CONTACT_EMAIL}`}>{SITE_CONTACT_EMAIL}</a>{" "}
        from the address you signed up with and we will remove it.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live you may have the right to access, correct, export or erase your
        personal data, or to object to how it is processed. Contact us at the address above to
        exercise any of these rights.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes materially we will update the date at the top of this page. Continued
        use of the service after a change means you accept the updated policy.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy? Email{" "}
        <a href={`mailto:${SITE_CONTACT_EMAIL}`}>{SITE_CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
