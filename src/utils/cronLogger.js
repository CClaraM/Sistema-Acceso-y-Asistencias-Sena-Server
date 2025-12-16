import { pool } from "../db/pool.js";

export async function cronLog(evento, detalles = null) {
  try {
    await pool.query(
      `INSERT INTO cron_log (evento, detalles)
       VALUES ($1, $2)`,
      [evento, detalles]
    );
  } catch (e) {
    console.error("cronLog error:", e);
  }
}
