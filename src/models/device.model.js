import { pool } from "../db/pool.js";

export const Device = {
  async create({ deviceKey, ambiente_id, jwtSecret, config }) {
    const now = new Date();

    const res = await pool.query(
      `INSERT INTO devices (device_key, ambiente_id, jwt_secret, config, last_seen_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [deviceKey, ambiente_id, jwtSecret, config, now]
    );

    return res.rows[0];
  },

  async updateLastSeen(deviceId) {
    await pool.query(
      `UPDATE devices
       SET last_seen_at = $1
       WHERE id = $2`,
      [new Date(), deviceId]
    );
  },

  async existsActive(deviceId) {
    const res = await pool.query(
      `SELECT id FROM devices 
       WHERE id = $1 AND is_active = true`,
      [deviceId]
    );
    return res.rows.length > 0;
  },

  async getById(deviceId) {
    const res = await pool.query(
      "SELECT * FROM devices WHERE id = $1",
      [deviceId]
    );
    return res.rows[0] || null;
  },

  async getDeviceSecret(deviceId) {
    const res = await pool.query(
      `SELECT jwt_secret FROM devices WHERE id = $1`,
      [deviceId]
    );
    return res.rows.length ? res.rows[0].jwt_secret : null;
  },

// Nuevo método para obtener metadata del ambiente
  async getAmbienteMetadata(ambiente_id) {
  const res = await pool.query(
    `
    SELECT 
      r.departamento AS regional,          -- Ej: 'Cauca'
      c.nombre       AS centro,            -- Ej: 'CTPI Cauca'
      a.nombre       AS ambiente           -- Ej: 'Software3'
    FROM ambiente a
    JOIN centro_formacion c 
      ON a.centro_formacion_id = c.id_centro_formacion
    JOIN regional r
      ON c.regional_id = r.id_regional
    WHERE a.id_ambiente = $1
    `,
    [ambiente_id]
  );

  return res.rows[0] || null;
}

};