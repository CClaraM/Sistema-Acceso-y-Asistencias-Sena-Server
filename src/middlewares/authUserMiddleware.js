import { TokenService } from "../services/TokenService.js";
import { errorResponse } from "../utils/errorResponse.js";

export function authUserMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const parts = header.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return errorResponse(res, 401, "Token no enviado");
  }

  try {
    const token = parts[1];
    const payload = TokenService.verifyUserToken(token);

    if (payload.type !== "user") {
      return errorResponse(res, 401, "Token inválido (no es token de usuario)");
    }

    req.userId = payload.sub;
    req.userRole = payload.role;
    req.userRolId = payload.userRolId;

    next();

  } catch (e) {
    return errorResponse(res, 401, "Token inválido o expirado");
  }
}
