import express from "express";
import cors from "cors";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

app.get("/api/ping", (_req, res) => {
  res.json({ ok: true, message: "pong", time: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
});
