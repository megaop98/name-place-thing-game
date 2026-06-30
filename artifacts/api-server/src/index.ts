import path from "path";
import fs from "fs";
import express from "express";
import { fileURLToPath } from "url";
import app from "./app";
import { setupSocketIO } from "./game";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.PORT) || 7860;

let frontendPath = path.resolve(__dirname, "../../game/dist");
if (!fs.existsSync(frontendPath)) {
    frontendPath = path.resolve(__dirname, "../../../game/dist");
}

app.use(express.static(frontendPath));

app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    
    const indexPath = path.join(frontendPath, "index.html");
    if (fs.existsSync(indexPath)) {
        res.setHeader("Content-Type", "text/html");
        fs.createReadStream(indexPath).pipe(res);
    } else {
        res.status(200).send("Server is live.");
    }
});

const httpServer = setupSocketIO(app);

httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
});
