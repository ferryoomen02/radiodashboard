import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/authRoutes.js";
import { radioRouter } from "./routes/radioRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/login-test", (_req, res) => {
  res.type("html");
  res.sendFile(path.join(__dirname, "..", "public", "login-test.html"));
});

app.use("/auth", authRouter);
app.use("/", radioRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Er ging iets mis op de server." });
});

export default app;
