const { getFirestore } = require("firebase-admin/firestore");
const { app } = require("../firebase-admin");
const estaDentroPeriodo = require("../utils/esta-dentro-periodo");

async function verificarAccesoExamen(req, res, next) {
    try {
        if (!req.usuario || !req.usuario.uid) {
            return res.status(401).json({
                error: "Autenticación requerida."
            });
        }

        const examenId = req.params.examenId;

        if (!examenId || typeof examenId !== "string") {
            return res.status(400).json({
                error: "Identificador de examen inválido."
            });
        }

        const db = getFirestore(app);

        const documentoEstudiante = await db
            .collection("usuarios")
            .doc(req.usuario.uid)
            .get();

        if (!documentoEstudiante.exists) {
            return res.status(403).json({
                error: "Perfil de usuario no encontrado."
            });
        }

        const perfil = documentoEstudiante.data();

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

        const grupoId = perfil.grupoActualId;

        if (!grupoId || typeof grupoId !== "string") {
            return res.status(403).json({
                error: "El estudiante no tiene un grupo asignado."
            });
        }

        const grupoRef = db.collection("grupos").doc(grupoId);
        const examenRef = db.collection("examenes").doc(examenId);

        const [documentoGrupo, documentoExamen] = await Promise.all([
            grupoRef.get(),
            examenRef.get()
        ]);

        if (!documentoGrupo.exists) {
            return res.status(403).json({
                error: "El grupo del estudiante no existe."
            });
        }

        const grupo = documentoGrupo.data();

        if (grupo.estado !== "activo") {
            return res.status(403).json({
                error: "El grupo del estudiante no está activo."
            });
        }

        if (!documentoExamen.exists) {
            return res.status(404).json({
                error: "Examen no encontrado."
            });
        }

        const examen = documentoExamen.data();

        if (examen.estado !== "activo") {
            return res.status(403).json({
                error: "El examen no está disponible."
            });
        }

        if (
            !Array.isArray(examen.gruposAsignados) ||
            !examen.gruposAsignados.includes(grupoId)
        ) {
            return res.status(403).json({
                error: "Este examen no está asignado al grupo del estudiante."
            });
        }

        const inicio = examen.disponibilidad?.inicio;
        const fin = examen.disponibilidad?.fin;

        if (
            !inicio ||
            !fin ||
            typeof inicio.toMillis !== "function" ||
            typeof fin.toMillis !== "function"
        ) {
            return res.status(403).json({
                error: "La disponibilidad del examen no está configurada correctamente."
            });
        }

        const ahora = Date.now();
        const inicioMs = inicio.toMillis();
        const finMs = fin.toMillis();

        if (
            !Number.isFinite(inicioMs) ||
            !Number.isFinite(finMs) ||
            inicioMs >= finMs
        ) {
            return res.status(403).json({
                error: "El período de disponibilidad del examen no es válido."
            });
        }

        if (!estaDentroPeriodo(ahora, inicioMs, finMs)) {
            return res.status(403).json({
                error: "El examen está fuera de su período de disponibilidad."
            });
        }

        req.perfilEstudiante = perfil;

        req.examenAutorizado = {
            id: documentoExamen.id,
            grupoId
        };

        next();
    } catch (error) {
        console.error("Error al verificar el acceso al examen:", error);

        return res.status(500).json({
            error: "No se pudo verificar el acceso al examen."
        });
    }
}

module.exports = verificarAccesoExamen;