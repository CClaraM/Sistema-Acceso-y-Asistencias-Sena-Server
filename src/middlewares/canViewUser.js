// middlewares/canViewUser.js
//Valida QUIÉN puede VER a QUIÉN
/*
Responsabilidad:
    aprendiz → solo a sí mismo
    instructor → solo si es líder de ficha activa
    coordinador → todos
    admin → todos
*/

import { pool } from "../db/pool.js";
import { errorResponse } from "../utils/errorResponse.js";

export async function canViewUser(req, res, next) {
  const actorUserId = req.userId;      // usuario (persona)
  const actorRole = req.userRole;
  const targetUserId = parseInt(req.params.id, 10);

  // Admin y coordinador pueden ver a todos
  if (actorRole === "admin" || actorRole === "coordinador") {
    return next();
  }

  // Aprendiz: solo puede verse a sí mismo
  if (actorRole === "aprendiz") {
    return actorUserId === targetUserId
      ? next()
      : errorResponse(res, 403, "No autorizado");
  }

  // Instructor: puede verse a sí mismo
  if (actorRole === "instructor" && actorUserId === targetUserId) {
    return next();
  }

  // Instructor líder: puede ver aprendices de su ficha activa
  if (actorRole === "instructor") {
    const result = await pool.query(
      `
      SELECT 1
      FROM ficha f
      JOIN inscripcion i
        ON i.ficha_numero = f.numero
      JOIN usuario_rol ur_aprendiz
        ON ur_aprendiz.id_usuario_rol = i.usuario_rol_id
      JOIN usuario_rol ur_instructor
        ON ur_instructor.id_usuario_rol = f.instructor_lider_id
      WHERE
        ur_instructor.usuario_id = $1     -- instructor (persona)
        AND ur_aprendiz.usuario_id = $2   -- aprendiz (persona)
        AND ur_aprendiz.rol = 'aprendiz'
        AND ur_instructor.rol = 'instructor'
        AND i.estado = 'ACTIVO'
      LIMIT 1
      `,
      [actorUserId, targetUserId]
    );

    if (result.rowCount > 0) {
      return next();
    }

    return errorResponse(
      res,
      403,
      "No autorizado"
    );
  }

  return errorResponse(res, 403, "No autorizado");
}
