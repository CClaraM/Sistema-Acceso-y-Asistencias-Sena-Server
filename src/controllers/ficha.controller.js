// controllers/ficha.controller.js
import { pool } from "../db/pool.js";
import { errorResponse } from "../utils/errorResponse.js";

// Crear nueva ficha
export async function createFicha(req, res) {
  try {
    const {
      numero,
      ambiente_id,
      instructor_lider_id,
      fecha_inicio,
      fecha_fin,
      programa_formacion_id,
      jornada
    } = req.body;

    // Verificar si la ficha ya existe
    const exists = await pool.query(
      `SELECT 1 FROM ficha WHERE numero = $1`,
      [numero]
    );

    // Si ya existe, retornar un error 409
    if (exists.rowCount > 0) {
      return errorResponse(res, 409, "La ficha ya existe");
    }

    // Validar que el número de ficha venga
    if (!numero || isNaN(numero)) {
      return errorResponse(res, 400, "Número de ficha inválido");
    }

    if (!numero || !ambiente_id || !instructor_lider_id || !jornada) {
      return errorResponse(res, 400, "Faltan datos obligatorios");
    }

    // Validar instructor líder
    const instructor = await pool.query(
      `
      SELECT 1
      FROM usuario_rol
      WHERE id_usuario_rol = $1
        AND rol = 'instructor'
        AND estado = 'ACTIVO'
      `,
      [instructor_lider_id]
    );

    if (instructor.rowCount === 0) {
      return errorResponse(
        res,
        400,
        "El instructor líder no es válido o no está activo"
      );
    }

    // Validar fechas
    if (fecha_inicio && fecha_fin && fecha_inicio > fecha_fin) {
      return errorResponse(res, 400, "La fecha de inicio no puede ser mayor a la fecha de fin");
    }

    // Insertar la nueva ficha
    await pool.query(
      `
      INSERT INTO ficha (
        numero,
        ambiente_id,
        instructor_lider_id,
        fecha_inicio,
        fecha_fin,
        programa_formacion_id,
        jornada
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,
      [
        numero,
        ambiente_id,
        instructor_lider_id,
        fecha_inicio,
        fecha_fin,
        programa_formacion_id,
        jornada
      ]
    );

    return res.status(201).json({ status: "Ficha creada", ficha: numero });
  } catch (e) {
    console.error("createFicha:", e);
    return errorResponse(res, 500, "Error interno");
  }
}

// Actualizar ficha con restricciones según estado
export async function updateFicha(req, res) {
  try {
    const fichaNumero = parseInt(req.params.fichaNumero, 10);
    const { ambiente_id, fecha_inicio, fecha_fin, estado } = req.body;

    const fichaRes = await pool.query(
      `SELECT estado FROM ficha WHERE numero = $1`,
      [fichaNumero]
    );

    if (!fichaRes.rowCount) {
      return errorResponse(res, 404, "Ficha no existe");
    }

    const estadoActual = fichaRes.rows[0].estado;

    const updates = [];
    const values = [];
    let idx = 1;

    // ambiente_id → siempre editable
    if (ambiente_id) {
      updates.push(`ambiente_id = $${idx++}`);
      values.push(ambiente_id);
    }

    // fechas → solo INSCRIPCIONES
    if ((fecha_inicio || fecha_fin) && estadoActual !== "INSCRIPCIONES") {
      return errorResponse(
        res,
        400,
        "Fechas solo pueden modificarse en estado INSCRIPCIONES"
      );
    }

    if (fecha_inicio) {
      updates.push(`fecha_inicio = $${idx++}`);
      values.push(fecha_inicio);
    }

    if (fecha_fin) {
      updates.push(`fecha_fin = $${idx++}`);
      values.push(fecha_fin);
    }

    // cambio de estado (solo forward)
    if (estado) {
      if (estadoActual === "INSCRIPCIONES" &&
          (estado === "FORMACION" || estado === "CANCELADA")) {
        updates.push(`estado = $${idx++}`);
        values.push(estado);
      } else if (estadoActual === "FORMACION" && estado === "CANCELADA") {
        updates.push(`estado = $${idx++}`);
        values.push(estado);
      } else {
        return errorResponse(res, 400, "Cambio de estado no permitido");
      }
    }

    if (!updates.length) {
      return errorResponse(res, 400, "No hay cambios válidos");
    }

    values.push(fichaNumero);

    await pool.query(
      `
      UPDATE ficha
      SET ${updates.join(", ")}
      WHERE numero = $${idx}
      `,
      values
    );

    return res.json({ status: "Ficha actualizada" });

  } catch (e) {
    console.error("updateFicha:", e);
    return errorResponse(res, 500, "Error interno");
  }
}

// Eliminar ficha Solo si está en INSCRIPCIONES
export async function deleteFicha(req, res) {
  try {
    const fichaNumero = parseInt(req.params.fichaNumero, 10);

    const fichaRes = await pool.query(
      `SELECT estado FROM ficha WHERE numero = $1`,
      [fichaNumero]
    );

    if (!fichaRes.rowCount) {
      return errorResponse(res, 404, "Ficha no existe");
    }

    if (fichaRes.rows[0].estado !== "INSCRIPCIONES") {
      return errorResponse(
        res,
        400,
        "Solo se pueden eliminar fichas en INSCRIPCIONES"
      );
    }

    await pool.query(
      `DELETE FROM ficha WHERE numero = $1`,
      [fichaNumero]
    );

    return res.json({ status: "Ficha eliminada" });

  } catch (e) {
    console.error("deleteFicha:", e);
    return errorResponse(res, 500, "Error interno");
  }
}
