/**
 * Site-wide constants surfaced in the footer, legal pages and metadata.
 * Keep public-facing copy here so it is edited in one place.
 */
export const SITE_NAME = "Audio Blendr";
export const SITE_TAGLINE = "Your Spotify library, playing on YouTube.";
export const SITE_REPO_URL = "https://github.com/dsyang1219/audio-blendr";

/**
 * Contact address shown on the legal pages. Override per deployment with
 * VITE_CONTACT_EMAIL so the source tree never hard-codes a personal address.
 */
export const SITE_CONTACT_EMAIL: string =
  import.meta.env.VITE_CONTACT_EMAIL || "privacy@example.com";

/** Bump when the privacy policy or terms materially change. */
export const LEGAL_LAST_UPDATED = "2026-09-18";

/** localStorage key recording that the visitor dismissed the storage notice. */
export const CONSENT_STORAGE_KEY = "audio-blendr:consent:v1";
