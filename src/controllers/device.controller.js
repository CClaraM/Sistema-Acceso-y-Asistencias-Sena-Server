import { errorResponse } from "../utils/errorResponse.js";
import { TokenService } from "../services/TokenService.js";
import { TST } from "../models/tst.model.js";
import { Device } from "../models/device.model.js";
import crypto from "crypto";

export const DeviceController = {
  async enroll(req, res) {

    //console.log("====================================");
    //console.log("🔵 [ENROLL] Solicitud recibida");
    //console.log("Body recibido:", req.body);
    //console.log("====================================");

    try {
      const { tst, deviceKey, config } = req.body;

      // LOG de datos recibidos
      //console.log("➡️ tst:", tst);
      //console.log("➡️ deviceKey:", deviceKey);
      //console.log("➡️ config:", config);

      if (!tst || !deviceKey || !config) {
        //console.log("❌ Faltan parámetros en el body");
        return errorResponse(res, 400, "Faltan parámetros");
      }

      const validTst = await TST.findValid(tst);
      //console.log("🔍 TST buscado:", validTst);

      //if (!validTst) return errorResponse(res, 400, "TST inválido o expirado");
      if (!validTst) {
        //console.log("❌ TST inválido o expirado");
        return errorResponse(res, 400, "TST inválido o expirado");
      }

      // Ambiente real (FK)
      const ambiente_id = validTst.ambiente_id;
      //console.log("🏫 ambiente_id encontrado:", ambiente_id);

      // IMPORTANTE: Si esto es null, el problema está en TST
      if (!ambiente_id || isNaN(ambiente_id)) {
        //console.log("❌ ERROR: ambiente_id es NULL o inválido en el TST");
        return errorResponse(res, 500, "ERROR: ambiente_id inválido en TST");
      }

      // si quieres traer los nombres reales:
      const meta = await Device.getAmbienteMetadata(ambiente_id);
      //console.log("📌 Metadata del ambiente:", meta);

      if (!meta) {
        //console.log("❌ No se encontró metadata del ambiente en SISPA");
        return errorResponse(res, 400, "Ambiente no encontrado en SISPA");
      }

      // Secreto único del dispositivo
      const jwtSecret = crypto.randomUUID();
      //console.log("🔐 jwt_secret generado:", jwtSecret);

      // Crear el dispositivo
      //console.log("📦 Registrando dispositivo...");
      const device = await Device.create({
        deviceKey,
        ambiente_id,
        jwtSecret,
        config
      });

      //console.log("✅ Dispositivo creado:", device);

      await TST.markUsed(validTst.id, device.id);
      //console.log("✳️ TST marcado como usado");

      // Crear tokens
      const accessToken = TokenService.signAccessToken(device.id, jwtSecret);
      const refreshToken = TokenService.signRefreshToken(device.id, jwtSecret);

      //console.log("🔑 accessToken generado:", accessToken.substring(0, 30), "...");
      //console.log("🔄 refreshToken generado:", refreshToken.substring(0, 30), "...");

      const response = {
          deviceId: device.id,
          accessToken,
          refreshToken,
          regional: meta.regional,
          centro: meta.centro,
          ambiente: meta.ambiente,
          ambiente_id
        };

      //console.log("📤 Respuesta enviada al dispositivo:", response);

      return res.json(response);

    } catch (e) {
      //console.error("enroll:", e);
      return errorResponse(res, 500, "Error interno");
    }
  },

  async ping(req, res) {
    try {
      const deviceId = req.deviceId;
      await Device.updateLastSeen(deviceId);

      return res.json({ status: "ok" });

    } catch (e) {
      console.error("ping:", e);
      return errorResponse(res, 500, "Error interno");
    }
  }
};