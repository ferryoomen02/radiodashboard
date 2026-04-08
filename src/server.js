import "dotenv/config";
import app from "./app.js";
import { assertJwtConfigured } from "./authTokens.js";

assertJwtConfigured();

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

app.listen(port, host, () => {
  console.log(`Radio API luistert op http://${host}:${port}`);
  console.log(`Health: http://127.0.0.1:${port}/health`);
});
