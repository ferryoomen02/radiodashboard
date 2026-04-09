import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/authRoutes.js";
import { radioRouter } from "./routes/radioRoutes.js";
import { stationsRouter } from "./routes/stationsApi.js";
import { usersRouter } from "./routes/usersApi.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(__dirname, "..", "public");
const assetsRoot = path.join(publicRoot, "assets");

const app = express();

app.use(cors());
app.use(express.json());

app.use(
  "/assets",
  express.static(assetsRoot, {
    maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.redirect(302, "/login");
});

function sendPage(name) {
  return (_req, res) => {
    res.type("html");
    res.sendFile(path.join(publicRoot, name));
  };
}

app.get("/login", sendPage("login.html"));
app.get("/dashboard", sendPage("dashboard.html"));
app.get("/stations", sendPage("stations.html"));
app.get("/users", sendPage("users.html"));
app.get("/account", sendPage("account.html"));

app.get("/login-test", (_req, res) => {
  res.redirect(302, "/login");
});

app.use("/auth", authRouter);
app.use("/api/stations", stationsRouter);
app.use("/api/users", usersRouter);
app.use("/", radioRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Er ging iets mis op de server." });
});

export default app;
