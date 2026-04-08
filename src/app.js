import express from "express";
import cors from "cors";
import { authRouter } from "./routes/authRoutes.js";
import { radioRouter } from "./routes/radioRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRouter);
app.use("/", radioRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Er ging iets mis op de server." });
});

export default app;
