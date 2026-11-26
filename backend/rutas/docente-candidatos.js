const express = require("express");
const { getFirestore } = require("firebase-admin/firestore");
const { app } = require("../firebase-admin");
const verificarDocente = require("../middleware/verificar-docente");

const router = express.Router();
const db = getFirestore(app);

router.get("/pendientes", verificarDocente, async (req, res) => {
    try {
        const snapshot = await db.collection("candidatos")
            .where("estado", "==", "pendiente")
            .get();

        const candidatos = snapshot.docs.map((documento) => {
            const datos = documento.data();

            return {
                nombresApellidos: datos.nombresApellidos || "",
                cedula: datos.cedula || "",
                correoElectronico: datos.correoElectronico || ""
            };
        }).sort((a, b) =>
            a.nombresApellidos.localeCompare(b.nombresApellidos, "es")
        );

        return res.status(200).json({ candidatos });

    } catch (error) {
        console.error("Error al consultar candidatos pendientes:", error.message);

        return res.status(500).json({
            error: "No se pudieron consultar los candidatos pendientes."
        });
    }
});

module.exports = router;
