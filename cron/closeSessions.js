import 'dotenv/config';
import { autoCerrarSesiones } from "../src/services/AutoCloseService.js";
import { cronLog } from "../src/utils/cronLogger.js";

async function run() {
  await cronLog("cron_ejecucion", "closeSessions ejecutado");
  await autoCerrarSesiones();
}

run().then(() => process.exit(0));

