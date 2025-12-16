// controllers/aprendizTutor.controller.js
import { pool } from "../db/pool.js";
import { errorResponse } from "../utils/errorResponse.js";

const ALLOWED_FIELDS = ["nombre", "apellido", "celular", "parentesco"];

// 🔎 Utilidad: obtener el usuario_rol del aprendiz
async function getUsuarioRolAprendiz(usuarioId) {
  const result = await pool.query(
    `
    SELECT id_usuario_rol
    FROM usuario_rol
    WHERE usuario_id = $1
      AND rol = 'aprendiz'
      AND estado = 'ACTIVO'
    `,
    [usuarioId]
  );

  return result.rowCount ? result.rows[0].id_usuario_rol : null;
}

// =====================
// GET ACUDIENTE
// =====================
export async function getAprendizTutor(req, res) {
  try {
    const targetUserId = parseInt(req.params.id, 10);

    const usuarioRolAprendiz = await getUsuarioRolAprendiz(targetUserId);
    if (!usuarioRolAprendiz) {
      return errorResponse(res, 404, "Usuario no tiene rol aprendiz activo");
    }

    const result = await pool.query(
      `
      SELECT nombre, apellido, celular, parentesco
      FROM aprendiz_tutor
      WHERE usuario_rol_aprendiz = $1
      `,
      [usuarioRolAprendiz]
    );

    if (!result.rowCount) {
      return errorResponse(res, 404, "Acudiente no registrado");
    }

    return res.json(result.rows[0]);
  } catch (e) {
    console.error("getAprendizTutor:", e);
    return errorResponse(res, 500, "Error interno");
  }
}

// =====================
// PUT ACUDIENTE (UPSERT)
// =====================
export async function updateAprendizTutor(req, res) {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const updates = req.body || {};

    const usuarioRolAprendiz = await getUsuarioRolAprendiz(targetUserId);
    if (!usuarioRolAprendiz) {
      return errorResponse(res, 404, "Usuario no tiene rol aprendiz activo");
    }

    const fields = Object.keys(updates).filter(f =>
      ALLOWED_FIELDS.includes(f)
    );

    if (fields.length === 0) {
      return errorResponse(res, 400, "No hay campos válidos para actualizar");
    }

    const cols = fields.join(", ");
    const placeholders = fields.map((_, i) => `$${i + 2}`).join(", ");
    const setClause = fields.map(f => `${f} = EXCLUDED.${f}`).join(", ");
    const values = [usuarioRolAprendiz, ...fields.map(f => updates[f])];

    const result = await pool.query(
      `
      INSERT INTO aprendiz_tutor (usuario_rol_aprendiz, ${cols})
      VALUES ($1, ${placeholders})
      ON CONFLICT (usuario_rol_aprendiz)
      DO UPDATE SET ${setClause}
      RETURNING nombre, apellido, celular, parentesco
      `,
      values
    );

    return res.json({ status: "OK", acudiente: result.rows[0] });
  } catch (e) {
    console.error("updateAprendizTutor:", e);
    return errorResponse(res, 500, "Error interno");
  }
}
