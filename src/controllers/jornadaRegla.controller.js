//controllers/jornadaRegla.controller.js
import { pool } from "../db/pool.js";
import { errorResponse } from "../utils/errorResponse.js";

export async function createJornadaRegla(req, res) {
  const { jornada, dia_semana, hora_inicio, hora_fin } = req.body;

  if (!jornada || !dia_semana || !hora_inicio || !hora_fin) {
    return errorResponse(res, 400, "Datos incompletos");
  }

  await pool.query(
    `
    INSERT INTO jornada_regla (jornada, dia_semana, hora_inicio, hora_fin)
    VALUES ($1,$2,$3,$4)
    `,
    [jornada, dia_semana, hora_inicio, hora_fin]
  );

  res.status(201).json({ status: "Regla creada" });
}

export async function updateJornadaRegla(req, res) {
  const { hora_inicio, hora_fin } = req.body;

  if (!hora_inicio && !hora_fin) {
    return errorResponse(res, 400, "No hay cambios");
  }

  await pool.query(
    `
    UPDATE jornada_regla
    SET hora_inicio = COALESCE($1, hora_inicio),
        hora_fin = COALESCE($2, hora_fin)
    WHERE id_jornada_regla = $3
    `,
    [hora_inicio, hora_fin, req.params.id]
  );

  res.json({ status: "Regla actualizada" });
}

export async function toggleJornadaRegla(req, res) {
  const { estado } = req.body;

  if (!["ACTIVO","INACTIVO"].includes(estado)) {
    return errorResponse(res, 400, "Estado inválido");
  }

  await pool.query(
    `
    UPDATE jornada_regla
    SET estado = $1
    WHERE id_jornada_regla = $2
    `,
    [estado, req.params.id]
  );

  res.json({ status: "Estado actualizado" });
}

export async function listJornadaReglas(req, res) {
  const result = await pool.query(
    `
    SELECT *
    FROM jornada_regla
    ORDER BY jornada, dia_semana, hora_inicio
    `
  );

  res.json(result.rows);
}
