export async function marcarFaltasAutomaticas(pool, sesion_id, ficha_numero) {
  // 1) Usuarios inscritos
  const inscritos = await pool.query(
    `SELECT id_inscripcion 
     FROM inscripcion
     WHERE ficha_numero = $1`,
    [ficha_numero]
  );

  // 2) Ya marcaron asistencia
  const registrados = await pool.query(
    `SELECT inscripcion_id
     FROM asistencia_academica
     WHERE sesion_id = $1`,
    [sesion_id]
  );

  const setRegistrados = new Set(registrados.rows.map(r => r.inscripcion_id));

  // 3) Los que no registraron asistencia = falta
  for (const ins of inscritos.rows) {
    if (!setRegistrados.has(ins.id_inscripcion)) {
      await pool.query(
        `INSERT INTO asistencia_academica (sesion_id, inscripcion_id, estado)
         VALUES ($1, $2, 'falta')
         ON CONFLICT DO NOTHING`,
        [sesion_id, ins.id_inscripcion]
      );
    }
  }
};