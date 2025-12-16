import { pool } from "../db/pool.js";

export const User = {
  async findByCorreo(correo) {
    const res = await pool.query(
      `SELECT u.*, ur.rol
       FROM usuario u
       JOIN usuario_rol ur ON ur.usuario_id = u.id_usuario
       WHERE ur.correo_rol = $1 AND ur.estado = 'ACTIVO'
       LIMIT 1`,
      [correo]
    );
    return res.rows[0] || null;
  },

  async findById(userId) {
    const res = await pool.query(
      `
      SELECT
        u.id_usuario,
        u.password,
        ur.id_usuario_rol,
        ur.rol,
        ur.correo_rol
      FROM usuario u
      JOIN usuario_rol ur ON ur.usuario_id = u.id_usuario
      WHERE u.id_usuario = $1
        AND ur.estado = 'ACTIVO'
      `,
      [userId]
    );

    return res.rows[0] || null;
  },

  async findByCorreoRol(correoRol) {
    const res = await pool.query(
      `
      SELECT
        u.id_usuario,
        u.password,
        ur.id_usuario_rol,
        ur.rol,
        ur.correo_rol
      FROM usuario_rol ur
      JOIN usuario u ON u.id_usuario = ur.usuario_id
      WHERE ur.correo_rol = $1
        AND ur.estado = 'ACTIVO'
      LIMIT 1
      `,
      [correoRol]
    );

    return res.rows[0] || null;
  },

  async updatePassword(id, passwordHash) {
    await pool.query(
      `UPDATE usuario SET password=$1 WHERE id_usuario=$2`,
      [passwordHash, id]
    );
  }
};
