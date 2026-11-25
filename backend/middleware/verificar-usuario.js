const { getAuth } = require("firebase-admin/auth");
const { app } = require("../firebase-admin");

async function verificarUsuario(req, res, next) {
    try {
        const autorizacion = req.headers.authorization;

        if (!autorizacion || !autorizacion.startsWith("Bearer ")) {
            return res.status(401).json({
                error: "Autenticacion requerida."
            });
        }

        const token = autorizacion.substring(7);

        const usuario = await getAuth(app).verifyIdToken(token, true);

        req.usuario = usuario;

        next();
    } catch (error) {
        return res.status(401).json({
            error: "Token de autenticacion invalido o vencido."
        });
    }
}

module.exports = verificarUsuario;
