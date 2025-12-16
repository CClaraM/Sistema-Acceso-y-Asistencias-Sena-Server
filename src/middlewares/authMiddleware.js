import jwt from "jsonwebtoken";
import { Device } from "../models/device.model.js";
import { errorResponse } from "../utils/errorResponse.js";

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const parts = header.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return errorResponse(res, 401, "Token no enviado");
  }

  const token = parts[1];

  try {
    // 1️⃣ Decodificar sin verificar (solo para obtener deviceId)
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.sub || decoded.type !== "access") {
      return errorResponse(res, 401, "Token inválido");
    }

    const deviceId = decoded.sub;

    // 2️⃣ Obtener el secreto real del dispositivo
    const deviceSecret = await Device.getDeviceSecret(deviceId);
    if (!deviceSecret) {
      return errorResponse(res, 401, "Dispositivo no encontrado");
    }

    // 3️⃣ Verificar la firma con el secreto del dispositivo
    jwt.verify(token, deviceSecret);

    // 4️⃣ Guardar deviceId para los controladores
    req.deviceId = deviceId;

    next();

  } catch (err) {
    return errorResponse(res, 401, "Token inválido o expirado");
  }
}
