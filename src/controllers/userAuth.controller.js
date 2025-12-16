// /src/controllers/userAuth.controller.js

import bcrypt from "bcryptjs";
import { User } from "../models/user.model.js";
import { TokenService } from "../services/TokenService.js";
import { errorResponse } from "../utils/errorResponse.js";

export const UserAuthController = {
  async login(req, res) {
    try {
      const { correo, password } = req.body;

      if (!correo || !password) {
        return errorResponse(res, 400, "Faltan datos");
      }

      // 🔑 Identidad de ROL (no de usuario)
      const identity = await User.findByCorreoRol(correo);

      if (!identity) {
        return errorResponse(res, 401, "Rol no encontrado");
      }

      if (identity.password === "NO_LOGIN") {
        return errorResponse(res, 401, "Usuario sin acceso");
      }

      const valid = await bcrypt.compare(password, identity.password);
      if (!valid) {
        return errorResponse(res, 401, "Credenciales incorrectas");
      }

      //const token = TokenService.signUserToken(user.id_usuario, user.rol);

      // ⬇️ token ligado al ROL
      const token = TokenService.signUserToken(
        identity.id_usuario,
        identity.rol,
        identity.id_usuario_rol
      );

      return res.json({
        userId: identity.id_usuario,
        userRolId: identity.id_usuario_rol,
        role: identity.rol,
        accessToken: token
      });
      /*
      return res.json({
        userId: user.id_usuario,
        role: user.rol,
        accessToken: token
      });*/

    } catch (e) {
      console.error("user login:", e);
      return errorResponse(res, 500, "Error interno");
    }
  }
};
