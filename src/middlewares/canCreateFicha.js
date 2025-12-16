// middlewares/canCreateFicha.js
import { errorResponse } from "../utils/errorResponse.js";

export function canCreateFicha(req, res, next) {
  const role = req.userRole;

  if (role === "admin" || role === "coordinador") {
    return next();
  }

  return errorResponse(res, 403, "No autorizado");
}
