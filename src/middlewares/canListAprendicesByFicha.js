// middlewares/canListAprendicesByFicha.js
// Permite listar aprendices de una ficha solo si el usuario es admin, coordinador,
// instructor líder de la ficha o instructor asignado a algún horario de la ficha.
import { pool } from "../db/pool.js";
import { errorResponse } from "../utils/errorResponse.js";

export async function canListAprendicesByFicha(req, res, next) {
  const actorUserId = req.userId;
  const actorRole = req.userRole;
  const fichaNumero = parseInt(req.params.fichaNumero, 10);

  // Admin y coordinador → siempre
  if (actorRole === "admin" || actorRole === "coordinador") {
    return next();
  }

  // Solo instructores pasan de aquí
  if (actorRole !== "instructor") {
    return errorResponse(res, 403, "No autorizado");
  }

  // 1️⃣ ¿Es instructor líder de la ficha?
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
    [fichaNumero, actorUserId]
  );

  if (lider.rowCount > 0) {
    return next();
  }

  // 2️⃣ ¿Está asignado a algún horario de esa ficha?
  const asignado = await pool.query(
    `
    SELECT 1
    FROM horario h
    JOIN usuario_rol ur ON ur.id_usuario_rol = h.instructor_id
    WHERE h.ficha_numero = $1
      AND ur.usuario_id = $2
      AND ur.rol = 'instructor'
    LIMIT 1
    `,
    [fichaNumero, actorUserId]
  );

  if (asignado.rowCount > 0) {
    return next();
  }

  return errorResponse(res, 403, "No autorizado");
}
