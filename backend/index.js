require("dotenv").config();

const express = require("express");

const verificarDocente = require("./middleware/verificar-docente");
const docenteExamenesRouter = require("./rutas/docente-examenes");
const candidatosRouter = require("./rutas/candidatos");
const verificarEstudiante = require("./middleware/verificar-estudiante");
const verificarAccesoExamen = require("./middleware/verificar-acceso-examen");

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");

const origenesPermitidos = [
    "http://localhost:5500",
    "https://universitariodematematica-star.github.io"
];

app.use((req, res, next) => {
    const origen = req.headers.origin;

    if (origenesPermitidos.includes(origen)) {
        res.setHeader("Access-Control-Allow-Origin", origen);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

app.use(express.json());
app.use("/api/docente/examenes", docenteExamenesRouter);
app.use("/api/publico/candidatos", candidatosRouter);

app.get("/api/estado", (req, res) => {
    res.json({
        estado: "activo",
        servicio: "Constructor de ExÃ¡menes API"
    });
});

app.get("/api/docente/verificacion", verificarDocente, (req, res) => {
    res.json({
        estado: "autorizado",
        mensaje: "Acceso docente verificado.",
        uid: req.usuario.uid
    });
});

app.get("/api/estudiante/verificacion", verificarEstudiante, (req, res) => {
    res.json({
        estado: "autorizado",
        mensaje: "Acceso de estudiante verificado.",
        uid: req.usuario.uid,
        nombre: `${req.perfilEstudiante.nombre} ${req.perfilEstudiante.apellido}`
    });
});
app.get(
    "/api/estudiante/examenes/:examenId",
    verificarEstudiante,
    verificarAccesoExamen,
    (req, res) => {
        res.json({
            estado: "autorizado",
            mensaje: "El estudiante puede acceder a este examen.",
            examenId: req.examenAutorizado.id
        });
    }
);

app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
