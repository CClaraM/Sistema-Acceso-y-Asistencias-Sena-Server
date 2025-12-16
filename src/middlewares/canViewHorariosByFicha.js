// middlewares/canViewHorariosByFicha.js
import { pool } from "../db/pool.js";
import { errorResponse } from "../utils/errorResponse.js";

export async function canViewHorariosByFicha(req, res, next) {
  try {
    const fichaNumero = parseInt(req.params.fichaNumero, 10);
    const userId = req.userId;
    const role = req.userRole;

    // 1️⃣ Admin / Coordinador → todo
    if (role === "admin" || role === "coordinador") {
      return next();
    }

    // 2️⃣ Aprendiz → solo sus fichas
    if (role === "aprendiz") {
      const inscrito = await pool.query(
        `
        SELECT 1
        FROM inscripcion i
        JOIN usuario_rol ur ON ur.id_usuario_rol = i.usuario_rol_id
        WHERE i.ficha_numero = $1
          AND ur.usuario_id = $2
          AND ur.rol = 'aprendiz'
          AND i.estado = 'ACTIVO'
        LIMIT 1
        `,
        [fichaNumero, userId]
      );

      if (inscrito.rowCount > 0) {
        return next();
      }

      return errorResponse(res, 403, "No autorizado");
    }

    // 3️⃣ Instructor → líder o asignado
    if (role === "instructor") {

      // 3a) Instructor líder
      const lider = await pool.query(
        `
        SELECT 1
        FROM ficha f
        JOIN usuario_rol ur ON ur.id_usuario_rol = f.instructor_lider_id
        WHERE f.numero = $1
          AND ur.usuario_id = $2
          AND ur.rol = 'instructor'
        LIMIT 1
        `,
        [fichaNumero, userId]
      );

      if (lider.rowCount > 0) {
        return next();
      }

      // 3b) Instructor asignado a horario
      const asignado = await pool.query(
        `
        SELECT 1
        FROM horario h
        JOIN usuario_rol ur ON ur.id_usuario_rol = h.instructor_id
        WHERE h.ficha_numero = $1
          AND ur.usuario_id = $2
          AND ur.rol = 'instructor'
          AND h.estado = 'ACTIVO'
        LIMIT 1
        `,
        [fichaNumero, userId]
      );

      if (asignado.rowCount > 0) {
        return next();
      }

      return errorResponse(res, 403, "No autorizado");
    }

    // 4️⃣ Otros roles
    return errorResponse(res, 403, "No autorizado");

  } catch (e) {
    console.error("canViewHorariosByFicha:", e);
    return errorResponse(res, 500, "Error interno");
  }
}
