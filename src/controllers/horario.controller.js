// controllers/horario.controller.js
import { pool } from "../db/pool.js";
import { errorResponse } from "../utils/errorResponse.js";

export async function createHorario(req, res) {
  const {
    trimestre_id,
    ficha_numero,
    ambiente_id,
    dia_semana,
    hora_inicio,
    hora_fin,
    instructor_id
  } = req.body;

  if (!trimestre_id || !ficha_numero || !ambiente_id || !dia_semana || !hora_inicio || !hora_fin || !instructor_id) {
    return errorResponse(res, 400, "Datos incompletos");
  }

  // 1️⃣ Obtener jornada de la ficha
  const ficha = await pool.query(
    `SELECT jornada FROM ficha WHERE numero = $1`,
    [ficha_numero]
  );

  if (!ficha.rowCount) {
    return errorResponse(res, 404, "Ficha no existe");
  }

  const jornada = ficha.rows[0].jornada;

  // 2️⃣ Validar contra reglas
  const reglas = await pool.query(
    `
    SELECT 1
    FROM jornada_regla
    WHERE jornada = $1
      AND dia_semana = $2
      AND estado = 'ACTIVO'
      AND $3 >= hora_inicio
      AND $4 <= hora_fin
    LIMIT 1
    `,
    [jornada, dia_semana, hora_inicio, hora_fin]
  );

  if (!reglas.rowCount) {
    return errorResponse(
      res,
      400,
      "Horario fuera de la jornada permitida"
    );
  }

  // 3️⃣ Insertar horario
  await pool.query(
    `
    INSERT INTO horario (
      trimestre_id, ficha_numero, ambiente_id,
      dia_semana, hora_inicio, hora_fin, instructor_id
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    `,
    [
      trimestre_id, ficha_numero, ambiente_id,
      dia_semana, hora_inicio, hora_fin, instructor_id
    ]
  );

  res.status(201).json({ status: "Horario creado" });
}

export async function updateHorario(req, res) {
  try {
    const horarioId = parseInt(req.params.id, 10);
    const {
      dia_semana,
      hora_inicio,
      hora_fin,
      ambiente_id,
      instructor_id
    } = req.body;

    // 1️⃣ Obtener horario actual
    const horarioRes = await pool.query(
      `
      SELECT h.*, f.jornada
      FROM horario h
      JOIN ficha f ON f.numero = h.ficha_numero
      WHERE h.id_horario = $1
      `,
      [horarioId]
    );

    if (!horarioRes.rowCount) {
      return errorResponse(res, 404, "Horario no existe");
    }

    const horario = horarioRes.rows[0];

    // 2️⃣ Si cambia día u horas → validar contra jornada
    const newDia = dia_semana ?? horario.dia_semana;
    const newInicio = hora_inicio ?? horario.hora_inicio;
    const newFin = hora_fin ?? horario.hora_fin;

    if (dia_semana || hora_inicio || hora_fin) {
      const regla = await pool.query(
        `
        SELECT 1
        FROM jornada_regla
        WHERE jornada = $1
          AND dia_semana = $2
          AND estado = 'ACTIVO'
          AND $3 >= hora_inicio
          AND $4 <= hora_fin
        LIMIT 1
        `,
        [horario.jornada, newDia, newInicio, newFin]
      );

      if (!regla.rowCount) {
        return errorResponse(
          res,
          400,
          "Horario fuera de la jornada permitida"
        );
      }
    }

    // 3️⃣ Update
    await pool.query(
      `
      UPDATE horario
      SET
        dia_semana   = COALESCE($1, dia_semana),
        hora_inicio  = COALESCE($2, hora_inicio),
        hora_fin     = COALESCE($3, hora_fin),
        ambiente_id  = COALESCE($4, ambiente_id),
        instructor_id= COALESCE($5, instructor_id)
      WHERE id_horario = $6
      `,
      [
        dia_semana,
        hora_inicio,
        hora_fin,
        ambiente_id,
        instructor_id,
        horarioId
      ]
    );

    return res.json({ status: "Horario actualizado" });

  } catch (e) {
    console.error("updateHorario:", e);
    return errorResponse(res, 500, "Error interno");
  }
}

export async function listHorariosByFicha(req, res) {
  try {
    const fichaNumero = parseInt(req.params.fichaNumero, 10);

    const result = await pool.query(
      `
      SELECT
        h.id_horario,
        h.trimestre_id,
        h.dia_semana,
        h.hora_inicio,
        h.hora_fin,
        h.ambiente_id,
        h.instructor_id,
        h.estado
      FROM horario h
      WHERE h.ficha_numero = $1
        AND h.estado = 'ACTIVO'
      ORDER BY
        h.dia_semana,
        h.hora_inicio
      `,
      [fichaNumero]
    );

    return res.json({
      ficha: fichaNumero,
      total: result.rowCount,
      horarios: result.rows
    });

  } catch (e) {
    console.error("listHorariosByFicha:", e);
    return errorResponse(res, 500, "Error interno");
  }
}

export async function toggleHorario(req, res) {
  try {
    const horarioId = parseInt(req.params.id, 10);
    const { estado } = req.body;

    if (!["ACTIVO","INACTIVO"].includes(estado)) {
      return errorResponse(res, 400, "Estado inválido");
    }

    const result = await pool.query(
      `
      UPDATE horario
      SET estado = $1
      WHERE id_horario = $2
      `,
      [estado, horarioId]
    );

    if (!result.rowCount) {
      return errorResponse(res, 404, "Horario no existe");
    }

    return res.json({ status: "Estado de horario actualizado" });

  } catch (e) {
    console.error("toggleHorario:", e);
    return errorResponse(res, 500, "Error interno");
  }
}

