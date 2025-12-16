// controllers/residencia.controller.js
import { pool } from "../db/pool.js";
import { errorResponse } from "../utils/errorResponse.js";

const ALLOWED_FIELDS = [
  "direccion",
  "municipio",
  "departamento",
  "sector",
  "estrato"
];


export async function updateResidencia(req, res) {
  try {
    const actorRole = req.userRole;
    const targetUserId = parseInt(req.params.id, 10);
    const updates = req.body || {};

    // (Opcional pero recomendado) no aceptar usuario_id en body
    if ("usuario_id" in updates) {
      return errorResponse(res, 400, "No envíes usuario_id en el body; usa el :id de la ruta");
    }

    // Filtrar campos permitidos (admin también, pero igual filtramos por seguridad)
    const fields = Object.keys(updates).filter((f) => ALLOWED_FIELDS.includes(f));

    if (fields.length === 0) {
      return errorResponse(res, 400, "No hay campos válidos para actualizar");
    }

    // Construir UPSERT dinámico
    const cols = fields.join(", ");
    const placeholders = fields.map((_, i) => `$${i + 2}`).join(", "); // empieza en $2 porque $1 será usuario_id
    const setClause = fields.map((f) => `${f} = EXCLUDED.${f}`).join(", ");

    const values = [targetUserId, ...fields.map((f) => updates[f])];

    const result = await pool.query(
      `
      INSERT INTO residencia (usuario_id, ${cols})
      VALUES ($1, ${placeholders})
      ON CONFLICT (usuario_id)
      DO UPDATE SET ${setClause}
      RETURNING usuario_id, direccion, municipio, departamento, sector, estrato
      `,
      values
    );

    return res.json({ status: "OK", residencia: result.rows[0] });
  } catch (e) {
    console.error("updateResidencia:", e);
    return errorResponse(res, 500, "Error interno");
  }
}

/*
export async function getResidencia(req, res) {
  try {
    const targetUserId = parseInt(req.params.id, 10);

    const result = await pool.query(
      `
      SELECT
        direccion,
        municipio,
        departamento,
        sector,
        estrato
      FROM residencia
      WHERE usuario_id = $1
      `,
      [targetUserId]
    );

    if (!result.rowCount) {
      return errorResponse(res, 404, "Residencia no registrada");
    }

    return res.json(result.rows[0]);

  } catch (e) {
    console.error("getResidencia:", e);
    return errorResponse(res, 500, "Error interno");
  }
}*/

export async function getResidencia(req, res) {
  try {
    const targetUserId = parseInt(req.params.id, 10);

    const result = await pool.query(
      `
      SELECT usuario_id, direccion, municipio, departamento, sector, estrato
      FROM residencia
      WHERE usuario_id = $1
      `,
      [targetUserId]
    );

    if (result.rowCount === 0) {
      return errorResponse(res, 404, "Residencia no encontrada");
    }

    return res.json(result.rows[0]);
  } catch (e) {
    console.error("getResidencia:", e);
    return errorResponse(res, 500, "Error interno");
  }
}
