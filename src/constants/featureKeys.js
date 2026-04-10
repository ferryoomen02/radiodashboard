/**
 * Feature-keys (slug) per zender. Opgeslagen in StationFeature + JSON-cache.
 */
export const FEATURE_KEYS = {
  DASHBOARD: "dashboard",
  TRACKS: "tracks",
  USERS: "users",
  STATIONS: "stations",
  COMPANIES: "companies",
  INVITES: "invites",
  DJS: "djs",
  AUDIOLOGGER: "audiologger",
  VIDEOLOGGER: "videologger",
  AI_PREPPER: "ai_prepper",
  PLAYLIST_PREP: "playlist_prep",
  TRAFFIC: "traffic",
  OMNI_IMPORT_EXPORT: "omni_import_export",
  APPBOX: "appbox",
  STUDIO_RESERVATION: "studio_reservation",
  FILES: "files",
  SITE_SETTINGS: "site_settings",
  MEDIA: "media",
  PLATFORM_BRANDING: "platform_branding",
};

/** Standaard bij nieuwe zender: volledige set. */
export const DEFAULT_STATION_FEATURES = Object.values(FEATURE_KEYS);

/** Vaste labels (fallback als FeatureDefinition ontbreekt). */
export const FEATURE_LABELS = {
  [FEATURE_KEYS.DASHBOARD]: "Dashboard",
  [FEATURE_KEYS.TRACKS]: "Tracks & playlist",
  [FEATURE_KEYS.USERS]: "Gebruikers",
  [FEATURE_KEYS.STATIONS]: "Zenderbeheer",
  [FEATURE_KEYS.COMPANIES]: "Bedrijven",
  [FEATURE_KEYS.INVITES]: "Uitnodigingen (super)",
  [FEATURE_KEYS.DJS]: "DJ's",
  [FEATURE_KEYS.AUDIOLOGGER]: "Audiologger",
  [FEATURE_KEYS.VIDEOLOGGER]: "Videologger",
  [FEATURE_KEYS.AI_PREPPER]: "AI prepper",
  [FEATURE_KEYS.PLAYLIST_PREP]: "Playlist prep",
  [FEATURE_KEYS.TRAFFIC]: "Traffic / verkeer",
  [FEATURE_KEYS.OMNI_IMPORT_EXPORT]: "Omni import/export",
  [FEATURE_KEYS.APPBOX]: "Appbox",
  [FEATURE_KEYS.STUDIO_RESERVATION]: "Studio-reservering",
  [FEATURE_KEYS.FILES]: "Bestanden (verkeer)",
  [FEATURE_KEYS.SITE_SETTINGS]: "Site-instellingen",
  [FEATURE_KEYS.MEDIA]: "Media",
  [FEATURE_KEYS.PLATFORM_BRANDING]: "Branding & portal",
};
