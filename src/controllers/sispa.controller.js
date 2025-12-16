import { pool } from "../db/pool.js";
import { errorResponse } from "../utils/errorResponse.js";

function diaSemanaFromDate(dateObj) {
  const dias = ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"];
  return dias[dateObj.getDay()];
}

function sumarMinutosTimeString(hora, minutos) {
  const [h, m, s] = hora.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m + minutos, s || 0);
  return d.toTimeString().slice(0, 8);
}

async function registrarLogAcceso(usuario_id, dispositivo_id, ambiente_id, metodo, resultado, motivo) {
  try {
    await pool.query(
      `INSERT INTO log_acceso
         (usuario_id, dispositivo_id, ambiente_id, metodo, rol_utilizado, resultado, motivo)
       VALUES ($1, $2, $3, $4, 'aprendiz', $5, $6)`,
      [usuario_id, dispositivo_id, ambiente_id, metodo, resultado, motivo]
    );
  } catch (e) {
    console.error("registrarLogAcceso error:", e);
  }
}

export const SispaController = {

  async getFichasByAmbiente(req, res) {
    try {
      const ambienteId = req.params.id;

      const result = await pool.query(`
        SELECT 
          f.id_ficha,
          f.codigo,
          p.nombre AS programa,
          fa.jornada
        FROM ficha_ambiente_jornada fa
        JOIN ficha f ON f.id_ficha = fa.ficha_id
        JOIN programa_formacion p ON p.id_programa = f.programa_id
        WHERE fa.ambiente_id = $1
      `, [ambienteId]);

      return res.json(result.rows);

    } catch (e) {
      console.error("getFichasByAmbiente:", e);
      return errorResponse(res, 500, "Error interno");
    }
  },

  async getHorarioActivo(req, res) {
    try {
        const ambienteId = req.params.id;

        const now = new Date();
        const diaSemana = now.getDay(); // 0 domingo, 1 lunes, ...

        const horaActual = now.toTimeString().substring(0, 8); // HH:MM:SS

        const result = await pool.query(`
        SELECT 
            h.id_horario,
            h.ficha_id,
            f.codigo AS ficha_codigo,
            h.dia_semana,
            h.hora_inicio,
            h.hora_fin
        FROM horario h
        JOIN ficha f ON f.id_ficha = h.ficha_id
        WHERE h.ambiente_id = $1
            AND h.dia_semana = $2
            AND h.hora_inicio <= $3
            AND h.hora_fin >= $3
        LIMIT 1
        `, [ambienteId, diaSemana, horaActual]);

        return res.json(result.rows[0] || { activo: false });

    } catch (e) {
        console.error("getHorarioActivo:", e);
        return errorResponse(res, 500, "Error interno");
    }
  },

  async getAprendicesByFicha(req, res) {
    try {
      const fichaId = req.params.id;

      const result = await pool.query(`
        SELECT 
          u.id_usuario,
          u.nombre,
          u.apellido,
          u.documento,
          u.celular
        FROM usuario_ficha uf
        JOIN usuario u ON u.id_usuario = uf.usuario_id
        WHERE uf.ficha_id = $1
      `, [fichaId]);

      return res.json(result.rows);

    } catch (e) {
      console.error("getAprendicesByFicha:", e);
      return errorResponse(res, 500, "Error interno");
    }
  },

  async syncAsistencias(req, res) {
    try {
      const dispositivoId = req.deviceId;
      const registros = req.body;

      if (!Array.isArray(registros) || registros.length === 0) {
        return errorResponse(res, 400, "Se requiere un arreglo de registros");
      }

      // 1) Ambiente desde el dispositivo (no confiamos en el cliente)
      const devRes = await pool.query(
        `SELECT ambiente_id FROM devices WHERE id = $1`,
        [dispositivoId]
      );
      if (devRes.rows.length === 0) {
        return errorResponse(res, 401, "Dispositivo no válido");
      }
      const ambiente_id = devRes.rows[0].ambiente_id;

      const resultados = [];
      const toleranciaMin = 15; // minutos

      for (const reg of registros) {
        const {
          local_id,
          usuario_id,
          timestamp,   // ISO string
          metodo = "FACENET"
        } = reg;

        // Estructura básica de respuesta por registro
        const respuestaItem = {
          local_id: local_id || null,
          resultado: null,
          estado_final: null,
          motivo: null
        };

        try {
          if (!usuario_id || !timestamp) {
            respuestaItem.resultado = "ERROR";
            respuestaItem.motivo = "usuario_id o timestamp faltante";
            resultados.push(respuestaItem);
            continue;
          }

          const fechaEvento = new Date(timestamp);
          if (isNaN(fechaEvento.getTime())) {
            respuestaItem.resultado = "ERROR";
            respuestaItem.motivo = "timestamp inválido";
            resultados.push(respuestaItem);
            continue;
          }

          const fechaISO = fechaEvento.toISOString().slice(0, 10); // YYYY-MM-DD
          const horaEvento = fechaEvento.toTimeString().slice(0, 8); // HH:MM:SS
          const diaSemana = diaSemanaFromDate(fechaEvento);          // lunes/martes...

          // 2) Buscar horario que corresponde a ese momento
          const horarioRes = await pool.query(
            `SELECT *
              FROM horario
              WHERE ambiente_id = $1
                AND dia_semana = $2
                AND hora_inicio <= $3
                AND hora_fin >= $3
              LIMIT 1`,
            [ambiente_id, diaSemana, horaEvento]
          );

          if (horarioRes.rows.length === 0) {
            respuestaItem.resultado = "RECHAZADO";
            respuestaItem.motivo = "No hay horario para ese momento en este ambiente";
            await registrarLogAcceso(usuario_id, dispositivoId, ambiente_id, metodo, "DENEGADO", respuestaItem.motivo);
            resultados.push(respuestaItem);
            continue;
          }

          const h = horarioRes.rows[0];

          // 3) Buscar o crear sesión para esa fecha
          let sesionRes = await pool.query(
            `SELECT *
             FROM sesion_clase
             WHERE horario_id = $1 AND fecha = $2
             LIMIT 1`,
            [h.id_horario, fechaISO]
          );

          let sesion;
          if (sesionRes.rows.length === 0) {
            // Creamos una sesión "finalizada" o "en_curso" según prefieras
            sesionRes = await pool.query(
              `INSERT INTO sesion_clase (horario_id, fecha, hora_inicio, estado)
               VALUES ($1, $2, $3, 'en_curso')
               RETURNING *`,
              [h.id_horario, fechaISO, h.hora_inicio]
            );
            sesion = sesionRes.rows[0];
          } else {
            sesion = sesionRes.rows[0];
          }

          const sesion_id = sesion.id_sesion;

          // 4) Verificar inscripción y estado (ACTIVO)
          const insRes = await pool.query(
            `SELECT id_inscripcion, estado
             FROM inscripcion
             WHERE ficha_numero = $1 AND usuario_id = $2
             LIMIT 1`,
            [h.ficha_numero, usuario_id]
          );

          if (insRes.rows.length === 0) {
            respuestaItem.resultado = "RECHAZADO";
            respuestaItem.motivo = "El usuario no está inscrito en la ficha";
            await registrarLogAcceso(usuario_id, dispositivoId, ambiente_id, metodo, "DENEGADO", respuestaItem.motivo);
            resultados.push(respuestaItem);
            continue;
          }

          const ins = insRes.rows[0];

          if (ins.estado !== "ACTIVO") {
            respuestaItem.resultado = "RECHAZADO";
            respuestaItem.motivo = `Inscripción no activa (${ins.estado})`;
            await registrarLogAcceso(usuario_id, dispositivoId, ambiente_id, metodo, "DENEGADO", respuestaItem.motivo);
            resultados.push(respuestaItem);
            continue;
          }

          const inscripcion_id = ins.id_inscripcion;

          // 5) Calcular estado presente/tarde según tolerancia
          const horaTolerancia = sumarMinutosTimeString(h.hora_inicio, toleranciaMin);
          const estadoNuevo = horaEvento <= horaTolerancia ? "presente" : "tarde";

          // 6) Ver si ya había asistencia registrada
          const asisRes = await pool.query(
            `SELECT id_asistencia, estado
             FROM asistencia_academica
             WHERE sesion_id = $1 AND inscripcion_id = $2`,
            [sesion_id, inscripcion_id]
          );

          if (asisRes.rows.length === 0) {
            // No existe -> insertar
            await pool.query(
              `INSERT INTO asistencia_academica (sesion_id, inscripcion_id, estado)
               VALUES ($1, $2, $3)`,
              [sesion_id, inscripcion_id, estadoNuevo]
            );
            respuestaItem.resultado = "ACEPTADO";
            respuestaItem.estado_final = estadoNuevo;
            await registrarLogAcceso(usuario_id, dispositivoId, ambiente_id, metodo, "PERMITIDO", `Asistencia sincronizada (${estadoNuevo})`);
            resultados.push(respuestaItem);
            continue;
          } else {
            // Ya existe
            const actual = asisRes.rows[0];

            if (actual.estado === "falta" && (estadoNuevo === "presente" || estadoNuevo === "tarde")) {
              // Corregimos falta previa
              await pool.query(
                `UPDATE asistencia_academica
                 SET estado = $1
                 WHERE id_asistencia = $2`,
                [estadoNuevo, actual.id_asistencia]
              );
              respuestaItem.resultado = "ACTUALIZADO_DESDE_FALTA";
              respuestaItem.estado_final = estadoNuevo;
              await registrarLogAcceso(usuario_id, dispositivoId, ambiente_id, metodo, "PERMITIDO", `Falta corregida a ${estadoNuevo} por sincronización`);
              resultados.push(respuestaItem);
              continue;
            } else {
              // Ya estaba presente/tarde
              respuestaItem.resultado = "DUPLICADO";
              respuestaItem.estado_final = actual.estado;
              respuestaItem.motivo = "Asistencia ya registrada";
              resultados.push(respuestaItem);
              continue;
            }
          }

        } catch (e) {
          console.error("Error en syncAsistencias item:", e);
          respuestaItem.resultado = "ERROR";
          respuestaItem.motivo = "Error interno al procesar este registro";
          resultados.push(respuestaItem);
        }
      }

      return res.json({ resultados });

    } catch (e) {
      console.error("syncAsistencias:", e);
      return errorResponse(res, 500, "Error interno en sincronización");
    }
  },

  // ===========================
  // 🔽 Descarga Delta
  // ===========================
  async syncBiometriaDelta(req, res) {
    try {
      const { deviceId, ambienteId } = req;      // token scope
      const { lastSync } = req.query;

      // Si no envía lastSync → FULL
      const lastSyncTime = lastSync ? new Date(lastSync) : new Date("1900-01-01");

      const result = await pool.query(
        `
        SELECT 
          bu.usuario_id,
          bu.tipo,
          encode(bu.embedding, 'base64') as template,
          bu.version,
          ur.rol,
          CASE 
            WHEN ins.estado = 'desertado' THEN 'REMOVIDO'
            ELSE 'ACTIVO'
          END as estado

        FROM biometria_usuario bu
        JOIN usuario u     ON u.id_usuario = bu.usuario_id
        JOIN inscripcion ins ON ins.usuario_id = u.id_usuario
        JOIN ficha f       ON f.numero = ins.ficha_numero
        WHERE 
            f.ambiente_id = $1
        AND (bu.fecha_registro > $2)
        `,
        [ambienteId, lastSyncTime]
      );

      return res.json({
        biometria: result.rows,
        ultimaSync: new Date()
      });

    } catch (e) {
      console.error("syncBiometriaDelta:", e);
      return res.status(500).json({error: "Error interno"});
    }
  },

  // ===========================
  // 🔼 Subida Delta
  // ===========================
  async uploadBiometria(req, res) {
  try {
    const { usuario_id, tipo, templateBase64, device_version, dedo, calidad } = req.body;
    const { ambienteId } = req;

    if (!usuario_id || !tipo || !templateBase64 || !device_version) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    // ---------------------------------------------------
    // 1) Validar scope (usuario pertenece al ambiente)
    // ---------------------------------------------------
    const scope = await pool.query(
      `
      SELECT 1
      FROM inscripcion i
      JOIN ficha f ON f.numero = i.ficha_numero
      WHERE i.usuario_id = $1
      AND f.ambiente_id = $2
      AND i.estado = 'ACTIVO'
      LIMIT 1
      `,
      [usuario_id, ambienteId]
    );

    if (!scope.rowCount) {
      return res.status(403).json({ error: "Usuario no pertenece al ambiente" });
    }

    // =====================================================
    // ============ CASE A: FACENET BIOMETRY ===============
    // =====================================================
    if (tipo === "FACENET") {

      // Consultar versión actual
      const current = await pool.query(
        `SELECT version FROM biometria_usuario WHERE usuario_id=$1 AND tipo='FACENET'`,
        [usuario_id]
      );

      // UPDATE
      if (current.rowCount) {
        const backend_version = current.rows[0].version;
        
        if (device_version <= backend_version) {
          return res.json({ status: "IGNORED_OUTDATED" });
        }

        await pool.query(
          `
          UPDATE biometria_usuario
          SET embedding = decode($1, 'base64'),
              version = $2,
              fecha_registro = NOW()
          WHERE usuario_id = $3 AND tipo='FACENET'
          `,
          [templateBase64, device_version, usuario_id]
        );
        return res.json({ status: "UPDATED_FACENET" });
      }

      // INSERT
      await pool.query(
        `
        INSERT INTO biometria_usuario (usuario_id, tipo, embedding, version)
        VALUES ($1, 'FACENET', decode($2,'base64'), $3)
        `,
        [usuario_id, templateBase64, device_version]
      );

      return res.json({ status: "CREATED_FACENET" });
    }

    // =====================================================
    // ============ CASE B: HUELLA BIOMETRY ================
    // =====================================================
    if (tipo === "HUELLA") {

      const current = await pool.query(
        `
        SELECT version
        FROM huella_usuario
        WHERE usuario_id=$1 AND dedo=$2
        `,
        [usuario_id, dedo || "DESCONOCIDO"]
      );

      // UPDATE
      if (current.rowCount) {

        const backend_version = current.rows[0].version;

        if (device_version <= backend_version) {
          return res.json({ status: "IGNORED_OUTDATED" });
        }

        await pool.query(
          `
          UPDATE huella_usuario
          SET template = decode($1,'base64'),
              calidad = $2,
              version = $3,
              fecha_registro = NOW()
          WHERE usuario_id=$4 AND dedo=$5
          `,
          [templateBase64, calidad || null, device_version, usuario_id, dedo || "DESCONOCIDO"]
        );

        return res.json({ status: "UPDATED_HUELLA" });
      }

      // INSERT
      await pool.query(
        `
        INSERT INTO huella_usuario (usuario_id, dedo, template, calidad, version)
        VALUES ($1, $2, decode($3,'base64'), $4, $5)
        `,
        [usuario_id, dedo || "DESCONOCIDO", templateBase64, calidad || null, device_version]
      );

      return res.json({ status: "CREATED_HUELLA" });
    }

    // -----------------------------------------------------
    //  No coincide con ningún tipo conocido
    // -----------------------------------------------------
    return res.status(400).json({ error: "Tipo biométrico no soportado" });

  } catch (e) {
    console.error("uploadBiometria:", e);
    return res.status(500).json({ error: "Error interno" });
  }
},

  async fullPayloadDevice(req, res) {
    try {
      const dispositivoId = req.deviceId;

      if (!dispositivoId) {
        return errorResponse(res, 401, "Dispositivo no autenticado");
      }

      // 1) Ambiente del dispositivo (scope)
      const devRes = await pool.query(
        `SELECT ambiente_id 
         FROM devices 
         WHERE id = $1 
           AND is_active = true`,
        [dispositivoId]
      );

      if (!devRes.rowCount) {
        return errorResponse(res, 403, "Dispositivo no registrado o inactivo");
      }

      const ambiente_id = devRes.rows[0].ambiente_id;

      // 2) Info básica del ambiente
      const ambRes = await pool.query(
        `SELECT 
            id_ambiente,
            numero,
            nombre,
            capacidad,
            restriccion_acceso
         FROM ambiente
         WHERE id_ambiente = $1`,
        [ambiente_id]
      );

      const ambiente = ambRes.rows[0] || null;

      // 3) Usuarios relevantes para este ambiente
      //  - Aprendices inscritos en fichas de este ambiente
      //  - Instructores que dictan en este ambiente (por horario)
      //
      //  NOTA:
      //  - Puedes extender luego para vigilancia/admin según cómo los asignes.
      //

      // 3.1 Aprendices
      const aprendicesRes = await pool.query(
        `
        SELECT DISTINCT
          u.id_usuario        AS usuario_id,
          u.nombre,
          u.apellido,
          'aprendiz'          AS rol,
          ins.estado          AS estado_inscripcion,
          f.numero            AS ficha_numero
        FROM inscripcion ins
        JOIN ficha f      ON f.numero = ins.ficha_numero
        JOIN usuario u    ON u.id_usuario = ins.usuario_id
        WHERE f.ambiente_id = $1
        `,
        [ambiente_id]
      );

      // 3.2 Instructores (tomados desde horario)
      const instructoresRes = await pool.query(
        `
        SELECT DISTINCT
          u.id_usuario        AS usuario_id,
          u.nombre,
          u.apellido,
          'instructor'        AS rol,
          NULL::text          AS estado_inscripcion,
          h.ficha_numero      AS ficha_numero
        FROM horario h
        JOIN usuario_rol ur ON ur.id_usuario_rol = h.instructor_id
        JOIN usuario u      ON u.id_usuario = ur.usuario_id
        WHERE h.ambiente_id = $1
          AND ur.rol = 'instructor'
          AND ur.estado = 'activo'
        `,
        [ambiente_id]
      );

      // Opcional: futuros roles (vigilancia/admin) se pueden agregar aquí

      const usuarios = [
        ...aprendicesRes.rows,
        ...instructoresRes.rows
      ];

      // 4) Biometría para estos usuarios
      const usuarioIds = [...new Set(usuarios.map(u => u.usuario_id))];

      let biometria = [];
      if (usuarioIds.length > 0) {
        const bioRes = await pool.query(
          `
          SELECT
            'FACENET' AS tipo,
            bu.usuario_id,
            encode(bu.embedding,'base64') AS template,
            bu.version
          FROM biometria_usuario bu
          WHERE bu.usuario_id = ANY($1)

          UNION ALL

          SELECT
            'HUELLA' AS tipo,
            hu.usuario_id,
            encode(hu.template,'base64') AS template,
            1 AS version   -- por ahora no versionamos huellas
          FROM huella_usuario hu
          WHERE hu.usuario_id = ANY($1)
          `,
          [usuarioIds]
        );
        biometria = bioRes.rows;
      }

      // 5) Sesión en curso (si existe) en este ambiente
      //
      //  Sesión: sesion_clase (horario_id, fecha, estado...)
      //  Para ligarla al ambiente: sesion_clase -> horario -> ambiente_id
      //
      const sesionRes = await pool.query(
        `
        SELECT 
          s.id_sesion,
          s.fecha,
          s.hora_inicio,
          s.hora_fin,
          s.estado,
          h.ficha_numero,
          h.instructor_id,
          s.instructor_real_id,
          s.reemplazo_de
        FROM sesion_clase s
        JOIN horario h ON h.id_horario = s.horario_id
        WHERE h.ambiente_id = $1
          AND s.estado = 'en_curso'
        ORDER BY s.fecha DESC, s.hora_inicio DESC
        LIMIT 1
        `,
        [ambiente_id]
      );

      let sesion = null;
      if (sesionRes.rowCount) {
        const row = sesionRes.rows[0];
        sesion = {
          id_sesion: row.id_sesion,
          en_curso: row.estado === 'en_curso',
          fecha: row.fecha,
          hora_inicio: row.hora_inicio,
          hora_fin: row.hora_fin,
          ficha_numero: row.ficha_numero,
          instructor_id: row.instructor_id,
          instructor_real_id: row.instructor_real_id,
          reemplazo_de: row.reemplazo_de
        };
      } else {
        sesion = { en_curso: false };
      }

      // 6) Respuesta final
      return res.json({
        ambiente,
        usuarios,
        biometria,
        huellas,
        sesion,
        ultimaSync: new Date().toISOString(),
        // Placeholder de versionamiento, luego lo conectas con campos reales
        versionamiento: {
          usuarios: 1,
          biometria: 1,
          huellas: 1, // opcional, por simetría
          permisos: 1
        }
      });

    } catch (e) {
      console.error("fullPayloadDevice:", e);
      return errorResponse(res, 500, "Error interno en fullPayload");
    }
  }

};