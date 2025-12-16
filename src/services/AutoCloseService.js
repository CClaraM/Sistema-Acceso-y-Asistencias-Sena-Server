import { pool } from "../db/pool.js";
import { cronLog } from "../utils/cronLogger.js";
import { marcarFaltasAutomaticas } from "../utils/asistenciaHelpers.js";

export async function autoCerrarSesiones() {
  try {
    const nowTime = new Date().toTimeString().slice(0,8);
    const today = new Date().toISOString().slice(0,10);

    // 1) Buscar sesiones activas cuyo horario ya terminó
    const sesiones = await pool.query(
      `SELECT s.id_sesion, s.horario_id, h.ficha_numero
       FROM sesion_clase s
       JOIN horario h ON s.horario_id = h.id_horario
       WHERE s.fecha = $1
         AND s.estado = 'en_curso'
         AND h.hora_fin <= $2`,
      [today, nowTime]
    );

    if (sesiones.rows.length === 0) {
      await cronLog("auto_cierre_sesion", "No hay sesiones para cerrar");
      return;
    }

    for (const ses of sesiones.rows) {
      // 2) Finalizar sesión
      await pool.query(
        `UPDATE sesion_clase
         SET estado = 'finalizada', hora_fin = $1
         WHERE id_sesion = $2`,
        [nowTime, ses.id_sesion]
      );

      // 3) Marcar faltas
      await marcarFaltasAutomaticas(pool, ses.id_sesion, ses.ficha_numero);

      // 4) Log del cierre
      await cronLog(
        "auto_cierre_sesion",
        `Sesion ${ses.id_sesion} finalizada y faltas marcadas (ficha ${ses.ficha_numero})`
      );
    }
  } catch (e) {
    await cronLog("error_cierre_sesion", e.message);
    console.error("autoCerrarSesiones error:", e);
  }
}
