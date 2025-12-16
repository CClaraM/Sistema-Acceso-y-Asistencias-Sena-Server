import jwt from "jsonwebtoken";
import { errorResponse } from "../utils/errorResponse.js";
import { TokenService } from "../services/TokenService.js";
import { Device } from "../models/device.model.js";

export const AuthController = {

  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return errorResponse(res, 400, "No se envió refreshToken");
      }

      // 1️⃣ Decodificar sin verificar aún
      const decoded = jwt.decode(refreshToken);
      if (!decoded || decoded.type !== "refresh") {
        return errorResponse(res, 401, "refreshToken inválido");
      }

      const deviceId = decoded.sub;

      // 2️⃣ Buscar el secreto único del dispositivo
      const deviceSecret = await Device.getDeviceSecret(deviceId);
      if (!deviceSecret) {
        return errorResponse(res, 404, "Dispositivo no encontrado");
      }

      // 3️⃣ Verificar refreshToken con el secret correcto
      try {
        jwt.verify(refreshToken, deviceSecret);
      } catch {
        return errorResponse(res, 401, "refreshToken expirado o inválido");
      }

      // 4️⃣ Generar nuevos tokens
      const newAccess = TokenService.signAccessToken(deviceId, deviceSecret);
      const newRefresh = TokenService.signRefreshToken(deviceId, deviceSecret);

      //console.log("🔑 accessToken generado:", newAccess);
      //console.log("🔄 refreshToken generado:", newRefresh);

      return res.json({
        accessToken: newAccess,
        refreshToken: newRefresh
      });

    } catch (e) {
      console.error("refresh:", e);
      return errorResponse(res, 500, "Error interno");
    }
  }
};
