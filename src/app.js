import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { platformSettingsRouter } from "./routes/platformSettingsApi.js";
import cors from "cors";
import { authRouter } from "./routes/authRoutes.js";
import { radioRouter } from "./routes/radioRoutes.js";
import { stationsRouter } from "./routes/stationsApi.js";
import { usersRouter } from "./routes/usersApi.js";
import { meRouter } from "./routes/meApi.js";
import { featureDefinitionsRouter } from "./routes/featureDefinitionsApi.js";
import { invitesRouter } from "./routes/invitesApi.js";
import { mediaRouter } from "./routes/mediaApi.js";
import { companiesRouter } from "./routes/companiesApi.js";
import { publicApiRouter } from "./routes/publicApi.js";
import { attachTenantSlug } from "./middleware/attachTenantSlug.js";
import { asyncHandler } from "./asyncHandler.js";
import { findActiveStationByPublicSlug } from "./lib/publicStation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const publicRoot = path.join(projectRoot, "public");
const assetsRoot = path.join(publicRoot, "assets");

const app = express();

app.use(cors());
app.use(express.json());
app.use(attachTenantSlug);

app.use(
  "/assets",
  express.static(assetsRoot, {
    maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
  })
);

app.use(
  "/uploads",
  express.static(path.join(projectRoot, "uploads"), {
    maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.tenantSlug) {
      return res.redirect(302, "/login");
    }
    const s = await findActiveStationByPublicSlug(req.tenantSlug);
    if (!s) {
      res.type("html");
      return res.sendFile(path.join(publicRoot, "station-unknown.html"));
    }
    res.type("html");
    return res.sendFile(path.join(publicRoot, "station-public.html"));
  })
);

function sendPage(name) {
  return (_req, res) => {
    res.type("html");
    res.sendFile(path.join(publicRoot, name));
  };
}

/** Volledig beheer (super / centraal portaal); op zender-subdomein niet bedoeld. */
function sendPageCentralOnly(name) {
  return (req, res) => {
    if (req.tenantSlug) {
      return res.redirect(302, "/dashboard");
    }
    res.type("html");
    res.sendFile(path.join(publicRoot, name));
  };
}

app.get("/login", sendPage("login.html"));
app.get("/dashboard", (req, res) => {
  res.type("html");
  if (req.tenantSlug) {
    return res.sendFile(path.join(publicRoot, "station-dashboard.html"));
  }
  return res.sendFile(path.join(publicRoot, "dashboard.html"));
});
app.get("/stations", sendPageCentralOnly("stations.html"));
app.get("/users", sendPageCentralOnly("users.html"));
app.get("/account", sendPage("account.html"));
app.get("/register", (req, res) => {
  if (req.tenantSlug) {
    const central = process.env.CENTRAL_PORTAL_URL?.trim();
    if (central) {
      return res.redirect(302, `${central.replace(/\/$/, "")}/register`);
    }
    return res.redirect(302, "/login");
  }
  res.type("html");
  res.sendFile(path.join(publicRoot, "register.html"));
});
app.get("/station-features", sendPageCentralOnly("station-features.html"));
app.get("/invites", sendPageCentralOnly("invites.html"));
app.get("/djs", sendPageCentralOnly("djs.html"));
app.get("/audiologger", sendPageCentralOnly("audiologger.html"));
app.get("/files", sendPageCentralOnly("files.html"));
app.get("/site-settings", sendPageCentralOnly("site-settings.html"));
app.get("/media", sendPageCentralOnly("media.html"));
app.get("/settings", sendPageCentralOnly("settings.html"));
app.get("/companies", sendPageCentralOnly("companies.html"));
app.get("/station/:id", sendPageCentralOnly("station-manage.html"));

app.get("/login-test", (_req, res) => {
  res.redirect(302, "/login");
});

app.use("/auth", authRouter);
app.use("/api", publicApiRouter);
app.use("/api", platformSettingsRouter);
app.use("/api", meRouter);
app.use("/api/feature-definitions", featureDefinitionsRouter);
app.use("/api/invites", invitesRouter);
app.use("/api/companies", companiesRouter);
app.use("/api/media", mediaRouter);
app.use("/api/stations", stationsRouter);
app.use("/api/users", usersRouter);
app.use("/", radioRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Er ging iets mis op de server." });
});

export default app;
