import { pool } from "../db/pool.js";
import { errorResponse } from "../utils/errorResponse.js";
import { marcarFaltasAutomaticas } from "../utils/asistenciaHelpers.js";

export const AsistenciaController = {

  async iniciarSesion(req, res) {
    try {
      const dispositivo_id = req.deviceId;  
      const { usuario_id, metodo } = req.body;

      console.log("➡️ Inicio sesión solicitado");
      console.log("usuario_id:", usuario_id);

      if (!usuario_id) {
        return errorResponse(res, 400, "usuario_id requerido");
      }

      // 1. Obtener info del dispositivo
      const device = await pool.query(
        "SELECT ambiente_id FROM devices WHERE id = $1",
        [dispositivo_id]
      );

      if (!device.rowCount) {
        return errorResponse(res, 403, "Dispositivo no registrado");
      }

      const ambiente_id = device.rows[0].ambiente_id;

      // 2. Buscar horario activo
      const now = new Date();
      const dia = now.toLocaleDateString("es-CO", { weekday: "long" });

      const hora = now.toTimeString().substring(0, 8);

      const horario = await pool.query(
        `SELECT * FROM horario 
         WHERE ambiente_id = $1 
           AND dia_semana = $2
           AND hora_inicio <= $3 
           AND hora_fin >= $3`,
        [ambiente_id, dia, hora]
      );

      if (!horario.rowCount) {
        return errorResponse(res, 400, "No hay clase programada en este momento");
      }

      const h = horario.rows[0];

      // 3. Validar si usuario es instructor
      const instructor = await pool.query(
        `SELECT * FROM usuario_rol 
         WHERE usuario_id = $1 AND rol='instructor' AND estado='activo'`,
        [usuario_id]
      );

      if (!instructor.rowCount) {
        return errorResponse(res, 403, "Usuario no es instructor");
      }

      const instructor_rol = instructor.rows[0];

      // 4. Determinar si es instructor asignado o reemplazo
      let esReemplazo = instructor_rol.id_usuario_rol !== h.instructor_id;

      // 5. Buscar o crear sesión del día
      const hoy = now.toISOString().substring(0, 10);

      let sesion = await pool.query(
        `SELECT * FROM sesion_clase 
         WHERE fecha = $1 AND horario_id = $2`,
        [hoy, h.id_horario]
      );

      if (!sesion.rowCount) {
        // Crear sesión nueva
        sesion = await pool.query(
          `INSERT INTO sesion_clase(
             horario_id, fecha, hora_inicio, estado, 
             instructor_real_id, reemplazo_de
           )
           VALUES ($1, $2, $3, 'en_curso', $4, $5)
           RETURNING *`,
          [
            h.id_horario,
            hoy,
            hora,
            instructor_rol.id_usuario_rol,
            esReemplazo ? h.instructor_id : null
          ]
        );
      } else {
        sesion = sesion.rows[0];
      }

      // 6. Registrar log_acceso
      await pool.query(
        `INSERT INTO log_acceso(
           usuario_id, dispositivo_id, ambiente_id,
           metodo, rol_utilizado, resultado
         )
         VALUES ($1, $2, $3, $4, 'instructor', 'PERMITIDO')`,
        [usuario_id, dispositivo_id, ambiente_id, metodo]
      );

      // 7. Respondemos
      return res.json({
        sesion_id: sesion.id_sesion,
        ficha_id: h.ficha_id,
        instructor_id: instructor_rol.id_usuario_rol,
        ambiente_id,
        estado: "en_curso",
        reemplazo: esReemplazo
      });

    } catch (e) {
      console.error("❌ Error iniciarSesion:", e);
      return errorResponse(res, 500, "Error interno");
    }
  },

  async registrarAsistencia(req, res) {
    try {
      const dispositivoId = req.deviceId;
      const { usuario_id, metodo = "FACENET", confianza } = req.body;

      if (!usuario_id) {
        return errorResponse(res, 400, "usuario_id es obligatorio");
      }

      // 1) Obtener ambiente del dispositivo
      const dev = await pool.query(
        `SELECT ambiente_id FROM devices WHERE id = $1`,
        [dispositivoId]
      );
      if (dev.rows.length === 0) {
        return errorResponse(res, 401, "Dispositivo no válido");
      }
      const ambiente_id = dev.rows[0].ambiente_id;

      // 2) Buscar sesión activa
      const nowDate = new Date().toISOString().slice(0,10); // YYYY-MM-DD
      const nowTime = new Date().toTimeString().slice(0,8); // HH:MM:SS

      const sesion = await pool.query(
        `SELECT s.*, h.ficha_numero, h.instructor_id
         FROM sesion_clase s
         JOIN horario h ON h.id_horario = s.horario_id
         WHERE s.fecha = $1
           AND h.ambiente_id = $2
           AND s.estado = 'en_curso'
           AND s.hora_inicio <= $3
           AND (s.hora_fin IS NULL OR s.hora_fin >= $3)
         LIMIT 1`,
        [nowDate, ambiente_id, nowTime]
      );

      let sesionActiva = sesion.rows[0];

      // 3) Si NO hay sesión
      if (!sesionActiva) {
        // verificar si es instructor con clase en este momento
        const puedeSerInstructor = await pool.query(
          `SELECT h.id_horario
           FROM horario h
           WHERE h.ambiente_id = $1
             AND h.instructor_id = (
                SELECT id_usuario_rol FROM usuario_rol WHERE usuario_id = $2 LIMIT 1
             )
             AND h.hora_inicio <= $3
             AND h.hora_fin >= $3
             AND h.dia_semana = (
                SELECT TRIM(TO_CHAR(CURRENT_DATE, 'day'))
             )`,
          [ambiente_id, usuario_id, nowTime]
        );

        if (puedeSerInstructor.rows.length > 0) {
          return res.json({
            status: "INSTRUCTOR_AUTORIZADO_SIN_SESION",
            mensaje: "Instructor autorizado. Debe iniciar sesión de clase."
          });
        }

        // aprendiz u otro → denegar
        await registrarLogAcceso(usuario_id, dispositivoId, ambiente_id, metodo, "DENEGADO", "No hay sesión activa");
        return errorResponse(res, 403, "No hay sesión activa");
      }

      // ----------------------------
      // 4) VALIDAR INSCRIPCIÓN
      // ----------------------------
      const ficha = sesionActiva.ficha_numero;

      const inscripcion = await pool.query(
        `SELECT id_inscripcion, estado
        FROM inscripcion
        WHERE ficha_numero = $1 AND usuario_id = $2
          AND estado = 'ACTIVO'`,
        [ficha, usuario_id]
      );

      if (inscripcion.rows.length === 0) {
        await registrarLogAcceso(usuario_id, dispositivoId, ambiente_id, metodo, "DENEGADO", "No está inscrito en esta ficha");
        return errorResponse(res, 403, "El usuario no pertenece a esta ficha");
      }

      const inscripcionId = inscripcion.rows[0].id_inscripcion;

      // ----------------------------
      // 5) CALCULAR ESTADO (presente / tarde)
      // ----------------------------
      const toleranciaMinutos = 15; // configurable
      const tolerancia = sumarMinutos(sesionActiva.hora_inicio, toleranciaMinutos);

      const estado = nowTime <= tolerancia ? "presente" : "tarde";

      // ----------------------------
      // 6) REGISTRAR ASISTENCIA
      // ----------------------------
      await pool.query(
        `INSERT INTO asistencia_academica (sesion_id, inscripcion_id, estado)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [sesionActiva.id_sesion, inscripcionId, estado]
      );

      // ----------------------------
      // 7) LOG DE ACCESO
      // ----------------------------
      await registrarLogAcceso(
        usuario_id,
        dispositivoId,
        ambiente_id,
        metodo,
        "PERMITIDO",
        `Asistencia registrada como ${estado}`
      );

      return res.json({
        status: "OK",
        asistencia: estado,
        mensaje: `Asistencia registrada correctamente (${estado}).`
      });

    } catch (e) {
      console.error("registrarAsistencia:", e);
      return errorResponse(res, 500, "Error interno");
    }
  },

  async finalizarSesionClase(req, res) {
  try {
    const dispositivoId = req.deviceId;
    const { usuario_id } = req.body;

    if (!usuario_id) {
      return errorResponse(res, 400, "usuario_id es obligatorio");
    }

    // 1) Obtener ambiente
    const dev = await pool.query(
      `SELECT ambiente_id FROM devices WHERE id = $1`,
      [dispositivoId]
    );
    if (!dev.rowCount) {
      return errorResponse(res, 401, "Dispositivo no válido");
    }

    const ambiente_id = dev.rows[0].ambiente_id;

    // 2) Obtener sesión activa
    const today = new Date().toISOString().slice(0, 10);
    const sesion = await pool.query(
      `SELECT s.*, h.instructor_id
       FROM sesion_clase s
       JOIN horario h ON s.horario_id = h.id_horario
       WHERE s.fecha = $1 AND s.estado = 'en_curso' AND h.ambiente_id = $2
       LIMIT 1`,
      [today, ambiente_id]
    );

    if (!sesion.rowCount) {
      return errorResponse(res, 404, "No hay sesión activa para finalizar");
    }

    const ses = sesion.rows[0];

    // 3) Verificar que usuario sea instructor
    const instructor = await pool.query(
      `SELECT id_usuario_rol
       FROM usuario_rol
       WHERE usuario_id = $1 AND rol = 'instructor' AND estado='activo'
       LIMIT 1`,
      [usuario_id]
    );

    if (!instructor.rowCount) {
      return errorResponse(res, 403, "No tiene permisos de instructor");
    }

    const instructor_rol_id = instructor.rows[0].id_usuario_rol;

    // 4) Permitir cierre solo si es instructor de la sesión
    //    o instructor real (reemplazo)
    const esInstructorOficial =
      ses.instructor_real_id === instructor_rol_id ||
      ses.instructor_id === instructor_rol_id;

    if (!esInstructorOficial) {
      await registrarLogAcceso(usuario_id, dispositivoId, ambiente_id, "FACENET", "DENEGADO", "Intento de cerrar sesión sin permisos");
      return errorResponse(res, 403, "No eres instructor de esta sesión");
    }

    // 5) Finalizar sesión
    const horaActual = new Date().toTimeString().slice(0, 8);
    await pool.query(
      `UPDATE sesion_clase
       SET estado = 'finalizada',
           hora_fin = $1
       WHERE id_sesion = $2`,
      [horaActual, ses.id_sesion]
    );

    // 6) Registrar log
    await registrarLogAcceso(usuario_id, dispositivoId, ambiente_id, "FACENET", "PERMITIDO", "Sesion finalizada por instructor");

    // 7) Marcar faltas para quienes no registraron asistencia
    await marcarFaltasAutomaticas(pool, ses.id_sesion, h.ficha_numero);

    return res.json({
      status: "OK",
      mensaje: "Sesión finalizada correctamente"
    });

  } catch (e) {
    console.error("finalizarSesionClase:", e);
    return errorResponse(res, 500, "Error interno del servidor");
  }
}

};

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function sumarMinutos(hora, minutos) {
  const [h, m, s] = hora.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m + minutos, s || 0);
  return date.toTimeString().slice(0,8);
}

async function registrarLogAcceso(usuario_id, dispositivo_id, ambiente_id, metodo, resultado, motivo) {
  await pool.query(
    `INSERT INTO log_acceso (usuario_id, dispositivo_id, ambiente_id, metodo, resultado, motivo)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [usuario_id, dispositivo_id, ambiente_id, metodo, resultado, motivo]
  );
}
