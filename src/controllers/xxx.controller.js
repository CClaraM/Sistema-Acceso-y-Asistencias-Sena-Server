// controllers/xxx.controller.js
import { pool } from "../db/pool.js";
import { errorResponse } from "../utils/errorResponse.js";

export async function updateXxx(req, res) {
  try {
    const actorRole = req.userRole;
    const targetUserId = parseInt(req.params.id, 10);
    const updates = req.body;

    // 1️⃣ Validar campos permitidos (si aplica)
    const ALLOWED_FIELDS = [ /* campos de la tabla */ ];

    const fields =
      actorRole === "admin"
        ? Object.keys(updates)
        : Object.keys(updates).filter(f => ALLOWED_FIELDS.includes(f));

    if (fields.length === 0) {
      return errorResponse(res, 400, "No hay campos válidos para actualizar");
    }

    // 2️⃣ Construir UPDATE dinámico
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");
    const values = fields.map(f => updates[f]);

    values.push(targetUserId);

    // 3️⃣ Ejecutar UPDATE (tabla específica)
    await pool.query(
      `
      UPDATE nombre_tabla
      SET ${setClause}
      WHERE usuario_id = $${values.length}
      `,
      values
    );

    return res.json({ status: "OK" });

  } catch (e) {
    console.error("updateXxx:", e);
    return errorResponse(res, 500, "Error interno");
  }
}
