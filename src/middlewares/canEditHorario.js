// middlewares/canEditHorario.js
import { errorResponse } from "../utils/errorResponse.js";

export function canEditHorario(req, res, next) {
  if (req.userRole === "admin" || req.userRole === "coordinador") {
    return next();
  }
  return errorResponse(res, 403, "No autorizado");
}