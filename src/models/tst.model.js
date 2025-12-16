import { pool } from "../db/pool.js";

export const TST = {
  async create({ code, ambiente_id, ambiente_nombre, expiresAt }) {
    const res = await pool.query(
      `INSERT INTO tst_tokens (code, ambiente_id, ambiente_nombre, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [code, ambiente_id, ambiente_nombre, expiresAt]
    );
    return res.rows[0];
  },

  async findValid(code) {
    const now = new Date();
    const res = await pool.query(
      `SELECT * FROM tst_tokens
       WHERE code=$1 AND used=false AND expires_at > $2`,
      [code, now]
    );
    return res.rows[0];
  },

  async markUsed(id, deviceId) {
    await pool.query(
      `UPDATE tst_tokens
       SET used=true, used_by_device=$1
       WHERE id=$2`,
      [deviceId, id]
    );
  }
};
