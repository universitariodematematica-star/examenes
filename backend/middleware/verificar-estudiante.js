const { getFirestore } = require("firebase-admin/firestore");
const { app } = require("../firebase-admin");
const verificarUsuario = require("./verificar-usuario");

async function verificarEstudiante(req, res, next) {
    verificarUsuario(req, res, async () => {
        try {
            const db = getFirestore(app);

            const documento = await db
                .collection("usuarios")
                .doc(req.usuario.uid)
                .get();

            if (!documento.exists) {
                return res.status(403).json({
                    error: "Perfil de usuario no encontrado."
                });
            }

            const perfil = documento.data();

            if (perfil.rol !== "estudiante") {
                return res.status(403).json({
                    error: "Este recurso es exclusivo para estudiantes."
                });
            }

            if (perfil.estado !== "activo") {
                return res.status(403).json({
                    error: "La cuenta de estudiante no está activa."
                });
            }

            req.perfilEstudiante = perfil;

            next();
        } catch (error) {
            console.error("Error al verificar el perfil del estudiante:", error);

            return res.status(500).json({
                error: "No se pudo verificar el perfil del estudiante."
            });
        }
    });
}

module.exports = verificarEstudiante;
