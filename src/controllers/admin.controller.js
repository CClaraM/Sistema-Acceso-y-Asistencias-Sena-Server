import { errorResponse } from "../utils/errorResponse.js";
import { generateTST } from "../utils/tstGenerator.js";
import { TST } from "../models/tst.model.js";

export const AdminController = {
  async createTst(req, res) {
    try {
      const { ambiente_id, ambiente_nombre, validMinutes = 5 } = req.body;

      if (!ambiente_id) {
        return errorResponse(res, 400, "Falta ambiente_id");
      }

      const code = generateTST();
      const expiresAt = new Date(Date.now() + validMinutes * 60000);

      const tst = await TST.create({
        code,
        ambiente_id,
        ambiente_nombre, // Nombre puede ser opcional o gestionado en otro lugar
        expiresAt
      });

      return res.json(tst);

    } catch (e) {
      console.error("createTst:", e);
      return errorResponse(res, 500, "Error interno");
    }
  }
};
