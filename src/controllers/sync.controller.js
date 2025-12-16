// src/controllers/sync.controller.js
import { pool } from "../db/pool.js";
import { errorResponse } from "../utils/errorResponse.js";

export const SyncController = {
  // -----------------------------------------------------------
  // 1) Saber si el dispositivo NECESITA sincronizar
  // GET /api/sync/status
  // -----------------------------------------------------------
  async getSyncStatus(req, res) {
    try {
      const deviceId = req.deviceId;

      if (!deviceId) {
        return errorResponse(res, 401, "Dispositivo no autenticado");
      }

      const r = await pool.query(
        `SELECT needs_sync 
         FROM devices 
         WHERE id = $1`,
        [deviceId]
      );

      if (!r.rowCount) {
        return errorResponse(res, 404, "Dispositivo no encontrado");
      }

      return res.json({ needsSync: r.rows[0].needs_sync });

    } catch (e) {
      console.error("getSyncStatus:", e);
      return errorResponse(res, 500, "Error interno");
    }
  },

  // -----------------------------------------------------------
  // 2) ENTREGAR FULL DATA AL DISPOSITIVO
  // GET /api/sync/full
  // -----------------------------------------------------------
  async getFullPayload(req, res) {
    const client = await pool.connect();
    try {
      const deviceId = req.deviceId;

      if (!deviceId) {
        client.release();
        return errorResponse(res, 401, "Dispositivo no autenticado");
      }

      // 1) Obtener ambiente del dispositivo
      const devRes = await client.query(
        `SELECT ambiente_id 
         FROM devices 
         WHERE id = $1 
           AND is_active = true`,
        [deviceId]
      );

      if (!devRes.rowCount) {
        client.release();
        return errorResponse(res, 403, "Dispositivo no registrado o inactivo");
      }

      const ambiente_id = devRes.rows[0].ambiente_id;

      // 2) Info del ambiente
      const ambRes = await client.query(
        `SELECT 
            id_ambiente,
            numero,
            capacidad,
            nombre,
            restriccion_acceso
         FROM ambiente
         WHERE id_ambiente = $1`,
        [ambiente_id]
      );

      const ambienteRow = ambRes.rows[0];

      // 3) Fichas activas (o vigentes por rango de fechas) en este ambiente
      const fichasRes = await client.query(
        `
        SELECT 
          f.numero,
          f.fecha_inicio,
          f.fecha_fin,
          pf.nombre AS programa,
          CASE 
            WHEN CURRENT_DATE BETWEEN f.fecha_inicio AND f.fecha_fin THEN 'ACTIVA'
            WHEN CURRENT_DATE < f.fecha_inicio THEN 'PROGRAMADA'
            ELSE 'FINALIZADA'
          END AS estado
        FROM ficha f
        JOIN programa_formacion pf 
          ON pf.id_programa_formacion = f.programa_formacion_id
        WHERE f.ambiente_id = $1
        `,
        [ambiente_id]
      );

      const fichas = fichasRes.rows;

      // 4) Aprendices activos asociados a fichas de este ambiente
      const aprendicesRes = await client.query(
        `
        SELECT DISTINCT
          u.id_usuario,
          u.documento,
          u.nombre,
          u.apellido,
          ins.estado AS estado_inscripcion,
          ins.ficha_numero,
          ur.id_usuario_rol,
          (
            SELECT COUNT(*) 
            FROM biometria_usuario b 
            WHERE b.usuario_id = u.id_usuario
          ) > 0 AS tiene_biometria
        FROM inscripcion ins
        JOIN ficha f 
          ON f.numero = ins.ficha_numero
        JOIN usuario_rol ur
          ON ur.id_usuario_rol = ins.usuario_rol_id
        JOIN usuario u
          ON u.id_usuario = ur.usuario_id
        WHERE 
          f.ambiente_id = $1
          AND ins.estado = 'ACTIVO';

        `,
        [ambiente_id]
      );

      const aprendices = aprendicesRes.rows.map(a => ({
        id_usuario: a.id_usuario,
        documento: a.documento,
        nombre: a.nombre,
        apellido: a.apellido,
        estado: a.estado_inscripcion,
        ficha_numero: a.ficha_numero,
        biometria: a.tiene_biometria
      }));

      // 5) Instructores que dictan en este ambiente (por horario)
      const instructoresRes = await client.query(
        `
        SELECT DISTINCT
          u.id_usuario,
          u.nombre,
          u.apellido
        FROM horario h
        JOIN usuario_rol ur 
          ON ur.id_usuario_rol = h.instructor_id
        JOIN usuario u 
          ON u.id_usuario = ur.usuario_id
        WHERE h.ambiente_id = $1
          AND ur.rol = 'instructor'
          AND ur.estado = 'ACTIVO'
        `,
        [ambiente_id]
      );

      const instructores = instructoresRes.rows.map(i => ({
        id_usuario: i.id_usuario,
        nombre: i.nombre,
        apellido: i.apellido,
        rol: "instructor",
        asignado: true
      }));

      // 6) Vigilancia (global, por ahora no restringimos por ambiente)
      const vigilanciaRes = await client.query(
        `
        SELECT DISTINCT
          u.id_usuario,
          u.nombre,
          u.apellido
        FROM usuario_rol ur
        JOIN usuario u 
          ON u.id_usuario = ur.usuario_id
        WHERE ur.rol = 'vigilancia'
          AND ur.estado = 'ACTIVO'
        `
      );

      const vigilancia = vigilanciaRes.rows.map(v => ({
        id_usuario: v.id_usuario,
        nombre: v.nombre,
        apellido: v.apellido,
        rol: "vigilancia"
      }));

      // 7) Biometría de todos los usuarios relevantes (aprendices + instructores + vigilancia)
      const usuariosIdsSet = new Set();
      aprendices.forEach(a => usuariosIdsSet.add(a.id_usuario));
      instructores.forEach(i => usuariosIdsSet.add(i.id_usuario));
      vigilancia.forEach(v => usuariosIdsSet.add(v.id_usuario));

      const usuariosIds = Array.from(usuariosIdsSet);

      let biometria = [];
      if (usuariosIds.length > 0) {
        const bioRes = await client.query(
          `
          SELECT 
            usuario_id,
            tipo,
            encode(embedding, 'base64') AS embedding,
            version
          FROM biometria_usuario
          WHERE usuario_id = ANY($1::int[])
          `,
          [usuariosIds]
        );
        biometria = bioRes.rows;
      }

      // 7 bis) HUELLA DIGITAL de los mismos usuarios
      let huellas = [];
      if (usuariosIds.length > 0) {
        const huellaRes = await client.query(
          `
          SELECT 
            usuario_id,
            dedo,
            encode(template, 'base64') AS templateBase64,
            calidad,
            version,
            fecha_registro
          FROM huella_usuario
          WHERE usuario_id = ANY($1::int[])
          `,
          [usuariosIds]
        );

        huellas = huellaRes.rows.map(r => ({
          usuario_id: r.usuario_id,
          dedo: r.dedo,
          templateBase64: r.templatebase64,
          calidad: r.calidad,
          version: r.version,
          fecha_registro: r.fecha_registro
        }));
      }


      // 8) Usuarios "removidos" (inscripción no activa) para este ambiente
      const removedRes = await client.query(
        `
        SELECT DISTINCT
          ur.usuario_id
        FROM inscripcion ins
        JOIN usuario_rol ur 
          ON ur.id_usuario_rol = ins.usuario_rol_id
        JOIN ficha f 
          ON f.numero = ins.ficha_numero
        WHERE f.ambiente_id = $1
          AND ins.estado <> 'ACTIVO'
        `,
        [ambiente_id]
      );

      const removed_users = removedRes.rows.map(r => r.usuario_id);

      // 9) Marcar dispositivo como sincronizado
      await client.query(
        `UPDATE devices
         SET needs_sync = false,
             last_full_sync = NOW()
         WHERE id = $1`,
        [deviceId]
      );

      client.release();

      // 10) Construir payload final
      const payload = {
        ambiente_id,
        metadata: {
          sync_id: new Date().toISOString(),
          tabla_version: 1 // placeholder por si luego quieres versionar
        },
        config_ambiente: ambienteRow
          ? {
              numero: ambienteRow.numero,
              capacidad: ambienteRow.capacidad,
              nombre: ambienteRow.nombre,
              restriccion: ambienteRow.restriccion_acceso
            }
          : null,
        fichas,
        aprendices,
        instructores,
        vigilancia,
        biometria,
        huellas,
        removed_users
      };

      return res.json(payload);

    } catch (e) {
      console.error("getFullPayload:", e);
      try { client.release(); } catch {}
      return errorResponse(res, 500, "Error interno en full sync");
    }
  },

  // -----------------------------------------------------------
  // 3) Recibir datos UPSERT desde el dispositivo
  // POST /api/sync/upload
  //
  // Aquí te dejo un esqueleto para que luego lo rellenemos
  // con la lógica de:
  //  - asistencias offline
  //  - logs de acceso offline
  //  - nuevas biometrías
  // -----------------------------------------------------------
  async uploadChanges(req, res) {
    try {
      const deviceId = req.deviceId;
      const { asistencias, accesos, biometria } = req.body || {};

      // Por ahora solo aceptamos y confirmamos.
      // Más adelante rellenamos cada bloque con validaciones
      // y UPSERTs reales.
      console.log("uploadChanges desde dispositivo:", deviceId);
      console.log("asistencias:", Array.isArray(asistencias) ? asistencias.length : 0);
      console.log("accesos:", Array.isArray(accesos) ? accesos.length : 0);
      console.log("biometria:", Array.isArray(biometria) ? biometria.length : 0);

      return res.json({
        status: "OK",
        message: "Datos recibidos (pendiente implementar UPSERT detallado)"
      });

    } catch (e) {
      console.error("uploadChanges:", e);
      return errorResponse(res, 500, "Error interno en upload");
    }
  }
};
