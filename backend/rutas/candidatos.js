const express = require("express");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { app } = require("../firebase-admin");

const router = express.Router();
const db = getFirestore(app);

router.post("/", async (req, res) => {
    try {
        const cuerpo = req.body || {};

        const nombres =
            typeof cuerpo.nombres === "string"
                ? cuerpo.nombres.trim().replace(/\s+/g, " ")
                : "";

        const apellidos =
            typeof cuerpo.apellidos === "string"
                ? cuerpo.apellidos.trim().replace(/\s+/g, " ")
                : "";

        const cedula =
            typeof cuerpo.cedula === "string"
                ? cuerpo.cedula.trim()
                : "";

        const correoElectronico =
            typeof cuerpo.correoElectronico === "string"
                ? cuerpo.correoElectronico.trim().toLowerCase()
                : "";

        if (!nombres || !apellidos || !cedula || !correoElectronico) {
            return res.status(400).json({
                error: "Debes completar todos los campos."
            });
        }

        if (
            nombres.length > 80 ||
            apellidos.length > 80 ||
            cedula.length > 30 ||
            correoElectronico.length > 254
        ) {
            return res.status(400).json({
                error: "Uno o varios campos superan la longitud permitida."
            });
        }

        const formatoCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!formatoCorreo.test(correoElectronico)) {
            return res.status(400).json({
                error: "El correo electrónico no tiene un formato válido."
            });
        }

        const candidatoRef = await db.collection("candidatos").add({
            nombres,
            apellidos,
            cedula,
            correoElectronico,
            estado: "pendiente",
            fechaRegistro: FieldValue.serverTimestamp()
        });

        return res.status(201).json({
            mensaje: "Tu solicitud fue recibida correctamente.",
            candidatoId: candidatoRef.id
        });

    } catch (error) {
        console.error("Error al registrar candidato:", error.message);

        return res.status(500).json({
            error: "No se pudo registrar la solicitud. Inténtalo nuevamente."
        });
    }
});

module.exports = router;
