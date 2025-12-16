import { errorResponse } from "../utils/errorResponse.js";

export function requireAdmin(req, res, next) {
  if (req.userRole !== "admin") {
    return errorResponse(res, 403, "Acceso denegado: solo administradores");
  }
  next();
}
