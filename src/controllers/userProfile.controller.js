// controllers/userProfile.controller.js
//valida campos editables según rol

import { pool } from "../db/pool.js";
import { errorResponse } from "../utils/errorResponse.js";

const EDITABLE_FIELDS = [
  "correo_personal",
  "celular",
  "tipo_documento",
  "documento"
];

const RESTRICTED_FIELDS = [
  "nombre",
  "apellido",
  "fecha_nacimiento"
];

export const UserProfileController = {

  async getProfile(req, res) {
    try {
      const targetUserId = parseInt(req.params.id, 10);

      const result = await pool.query(
        `
        SELECT
          u.id_usuario,
          u.nombre,
          u.apellido,
          u.correo_personal,
          u.celular,
          u.tipo_documento,
          u.documento,
          u.fecha_nacimiento
        FROM usuario u
        WHERE u.id_usuario = $1
        `,
        [targetUserId]
      );

      if (!result.rowCount) {
        return errorResponse(res, 404, "Usuario no encontrado");
      }

      return res.json(result.rows[0]);

    } catch (e) {
      console.error("getProfile:", e);
      return errorResponse(res, 500, "Error interno");
    }
  },

  async updateProfile(req, res) {
    try {
      const actorRole = req.userRole;
      const targetUserId = parseInt(req.params.id, 10);
      const updates = req.body;

      // Aprendiz / instructor: bloquear campos restringidos
      if (actorRole === "aprendiz" || actorRole === "instructor") {
        for (const field of RESTRICTED_FIELDS) {
          if (field in updates) {
            return errorResponse(
              res,
              403,
              `No puede modificar el campo: ${field}`
            );
          }
        }
      }

      let fields;

      // 👑 Admin: todo permitido
      if (actorRole === "admin") {
        fields = Object.keys(updates);
      } else {
        fields = Object.keys(updates).filter(f =>
          EDITABLE_FIELDS.includes(f)
        );
      }

      if (fields.length === 0) {
        return errorResponse(res, 400, "No hay campos válidos para actualizar");
      }

      // Construir UPDATE dinámico
      const setClause = fields
        .map((f, i) => `${f} = $${i + 1}`)
        .join(", ");

      const values = fields.map(f => updates[f]);
      values.push(targetUserId);

      await pool.query(
        `
        UPDATE usuario
        SET ${setClause}
        WHERE id_usuario = $${values.length}
        `,
        values
      );

      return res.json({ status: "OK" });

    } catch (e) {
      console.error("updateProfile:", e);
      return errorResponse(res, 500, "Error interno");
    }
  }

};
