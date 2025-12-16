// middlewares/canEnrollAprendiz.js
import { pool } from "../db/pool.js";
import { errorResponse } from "../utils/errorResponse.js";

export async function canEnrollAprendiz(req, res, next) {
  const actorUserId = req.userId;
  const actorRole = req.userRole;
  const fichaNumero = parseInt(req.params.fichaNumero, 10);

  // Admin y coordinador → siempre
  if (actorRole === "admin" || actorRole === "coordinador") {
    return next();
  }

  // Instructor: solo si es líder de la ficha
  if (actorRole === "instructor") {
    const result = await pool.query(
      `
      SELECT 1
      FROM ficha f
      JOIN usuario_rol ur
        ON ur.id_usuario_rol = f.instructor_lider_id
      WHERE f.numero = $1
        AND ur.usuario_id = $2
        AND ur.rol = 'instructor'
      LIMIT 1
      `,
      [fichaNumero, actorUserId]
    );

    if (result.rowCount > 0) {
      return next();
    }
  }

  return errorResponse(res, 403, "No autorizado");
}
