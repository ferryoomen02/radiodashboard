/**
 * Feature-keys (slug) per zender. Gebruikt in Station.enabledFeatures (JSON-array).
 * Routes en sidebar mappen hierop.
 */
export const FEATURE_KEYS = {
  DASHBOARD: "dashboard",
  TRACKS: "tracks",
  USERS: "users",
  STATIONS: "stations",
  INVITES: "invites",
  DJS: "djs",
  AUDIOLOGGER: "audiologger",
  FILES: "files",
  SITE_SETTINGS: "site_settings",
  MEDIA: "media",
};

/** Standaard bij nieuwe zender: alles aan. */
export const DEFAULT_STATION_FEATURES = Object.values(FEATURE_KEYS);

/** Vaste labels (fallback als FeatureDefinition ontbreekt). */
export const FEATURE_LABELS = {
  [FEATURE_KEYS.DASHBOARD]: "Dashboard",
  [FEATURE_KEYS.TRACKS]: "Tracks & playlist",
  [FEATURE_KEYS.USERS]: "Gebruikers",
  [FEATURE_KEYS.STATIONS]: "Zenderbeheer",
  [FEATURE_KEYS.INVITES]: "Uitnodigingen (super)",
  [FEATURE_KEYS.DJS]: "DJ's",
  [FEATURE_KEYS.AUDIOLOGGER]: "Audiologger",
  [FEATURE_KEYS.FILES]: "Bestanden (verkeer)",
  [FEATURE_KEYS.SITE_SETTINGS]: "Site-instellingen",
  [FEATURE_KEYS.MEDIA]: "Media",
};
