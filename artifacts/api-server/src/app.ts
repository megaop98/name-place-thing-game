import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

export default app;
