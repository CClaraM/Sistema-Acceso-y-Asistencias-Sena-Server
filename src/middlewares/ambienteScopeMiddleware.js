import { Device } from "../models/device.model.js";
import { errorResponse } from "../utils/errorResponse.js";

export async function ambienteScopeMiddleware(req, res, next) {
  try {
    const deviceId = req.deviceId;          // viene del authMiddleware
    const ambienteSolicitado = parseInt(req.params.id);

    // Obtener ambiente asignado al dispositivo
    const device = await Device.getById(deviceId);
    if (!device) {
      return errorResponse(res, 403, "Dispositivo no encontrado");
    }

    const ambienteAsignado = device.ambiente_id;

    if (ambienteAsignado !== ambienteSolicitado) {
      return errorResponse(
        res,
        403,
        "Dispositivo NO autorizado para consultar este ambiente"
      );
    }

    next();

  } catch (e) {
    console.error("ambienteScopeMiddleware:", e);
    return errorResponse(res, 500, "Error interno");
  }
}
