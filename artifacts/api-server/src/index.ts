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

app.get("/healthz", (req, res) => {
    res.status(200).send("OK");
});

app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    
    const indexPath = path.join(frontendPath, "index.html");
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.status(200).send(`Server is live. Target path: ${frontendPath}`);
        }
    });
});

const httpServer = setupSocketIO(app);

httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
});
