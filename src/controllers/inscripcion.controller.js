// controllers/inscripcion.controller.js
import { pool } from "../db/pool.js";
import { errorResponse } from "../utils/errorResponse.js";

export async function inscribirAprendiz(req, res) {
  try {
    const fichaNumero = parseInt(req.params.fichaNumero, 10);
    const { usuario_rol_aprendiz } = req.body;

    if (!usuario_rol_aprendiz) {
      return errorResponse(res, 400, "Falta usuario_rol_aprendiz");
    }

    const ficha = await pool.query(
      `
      SELECT estado
      FROM ficha
      WHERE numero = $1
      `,
      [fichaNumero]
    );

    if (ficha.rowCount === 0) {
      return errorResponse(res, 404, "La ficha no existe");
    }

    if (ficha.rows[0].estado !== 'INSCRIPCIONES') {
      return errorResponse(
        res,
        400,
        "La ficha no está en estado de inscripciones"
      );
    }
    
    await pool.query(
      `
      INSERT INTO inscripcion (usuario_rol_id, ficha_numero, estado)
      VALUES ($1, $2, 'ACTIVO')
      ON CONFLICT (usuario_rol_id, ficha_numero)
      DO UPDATE SET estado = 'ACTIVO'
      `,
      [usuario_rol_aprendiz, fichaNumero]
    );

    return res.status(201).json({
      status: "Aprendiz inscrito",
      ficha: fichaNumero
    });
  } catch (e) {
    console.error("inscribirAprendiz:", e);
    return errorResponse(res, 500, "Error interno");
  }
}
