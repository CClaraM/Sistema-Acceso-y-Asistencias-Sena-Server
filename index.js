import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Usuarios y su administracion
import adminRoutes from "./src/routes/admin.routes.js";
import deviceRoutes from "./src/routes/device.routes.js";
import authRoutes from "./src/routes/auth.routes.js";
import sispaRoutes from "./src/routes/sispa.routes.js";
import syncRoutes from "./src/routes/sync.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import fichaRoutes from "./src/routes/ficha.routes.js";
import jornadaRoutes from "./src/routes/jornada.routes.js";
import horarioRoutes from "./src/routes/horario.routes.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Usuarios y su administracion
app.use("/api/admin", adminRoutes);
app.use("/api/device", deviceRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/sispa", sispaRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api", userRoutes);



// Dpminio academico - Fichas, horarios...
app.use("/api", fichaRoutes);
app.use("/api", jornadaRoutes);
app.use("/api", horarioRoutes);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Running on http://0.0.0.0:${PORT}`);
});