const verificarUsuario = require("./verificar-usuario");

function verificarDocente(req, res, next) {
    verificarUsuario(req, res, () => {
        if (req.usuario.docente !== true) {
            return res.status(403).json({
                error: "No tienes permisos para acceder a este recurso."
            });
        }

        next();
    });
}

module.exports = verificarDocente;
