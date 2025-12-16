//canEditUser.js
//Valida QUIÉN puede EDITAR a QUIÉN
/*
Responsabilidad:
    aprendiz → solo a sí mismo
    instructor → solo a sí mismo
    coordinador → todos EXCEPTO admin
    admin → todos
*/

import { errorResponse } from "../utils/errorResponse.js";

export function canEditUser(req, res, next) {
  const actorUserId = req.userId;
  const actorRole = req.userRole;
  const targetUserId = parseInt(req.params.id, 10);

  // Admin puede modificar a cualquiera
  if (actorRole === "admin") {
    return next();
  }

  // Coordinador puede modificar a todos EXCEPTO admin
  if (actorRole === "coordinador") {
    // el bloqueo a admin se hace en el controller (más contexto)
    return next();
  }

  // Aprendiz e instructor SOLO pueden modificarse a sí mismos
  if (
    (actorRole === "aprendiz" || actorRole === "instructor") &&
    actorUserId === targetUserId
  ) {
    return next();
  }

  return errorResponse(res, 403, "No autorizado");
}
