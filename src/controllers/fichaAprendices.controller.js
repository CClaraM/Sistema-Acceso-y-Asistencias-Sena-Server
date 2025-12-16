// controllers/fichaAprendices.controller.js
import { pool } from "../db/pool.js";
import { errorResponse } from "../utils/errorResponse.js";

export async function listAprendicesByFicha(req, res) {
  try {
    const fichaNumero = parseInt(req.params.fichaNumero, 10);

    const result = await pool.query(
        `
        SELECT
            u.id_usuario,
            u.nombre,
            u.apellido,
            ur.id_usuario_rol,
            i.estado
        FROM inscripcion i
        JOIN usuario_rol ur
            ON ur.id_usuario_rol = i.usuario_rol_id
        JOIN usuario u
            ON u.id_usuario = ur.usuario_id
        WHERE i.ficha_numero = $1
            AND ur.rol = 'aprendiz'
        ORDER BY
            CASE i.estado
            WHEN 'ACTIVO' THEN 1
            WHEN 'ANULADO' THEN 2
            WHEN 'CERTIFICADO' THEN 3
            END,
            u.apellido,
            u.nombre
        `,
        [fichaNumero]
    );

    return res.json({
      ficha: fichaNumero,
      total: result.rowCount,
      aprendices: result.rows
    });

  } catch (e) {
    console.error("listAprendicesByFicha:", e);
    return errorResponse(res, 500, "Error interno");
  }
}
