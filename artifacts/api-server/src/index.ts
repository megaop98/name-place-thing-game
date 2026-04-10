import path from "path";
import express from "express";
import { fileURLToPath } from "url";
import app from "./app";
import { setupSocketIO } from "./game";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.PORT) || 7860;

const frontendPath = path.resolve(__dirname, "../../game/dist");
app.use(express.static(frontendPath));

// Express 5 requires wildcards to be formatted as (.*)
app.get("(.*)", (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(frontendPath, "index.html"));
});

const httpServer = setupSocketIO(app);

httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
});