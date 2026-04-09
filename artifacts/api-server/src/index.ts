import app from "./app";
import { setupSocketIO } from "./game";

const port = Number(process.env.PORT) || 3000;

const httpServer = setupSocketIO(app);

httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
});
