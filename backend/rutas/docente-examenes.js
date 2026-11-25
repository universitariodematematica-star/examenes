const express = require("express");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { app } = require("../firebase-admin");
const verificarDocente = require("../middleware/verificar-docente");

const router = express.Router();
const db = getFirestore(app);

router.get("/campos-estudio", verificarDocente, async (req, res) => {
    try {
        const snapshot = await db.collection("campos_estudio").get();

        const campos = snapshot.docs.map((documento) => ({
            id: documento.id,
            nombre: documento.data().nombre
        })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

        return res.status(200).json({ campos });
    } catch (error) {
        console.error("Error al consultar los campos de estudio:", error.message);

        return res.status(500).json({
            error: "No se pudieron consultar los campos de estudio."
        });
    }
});

router.get("/campos-estudio/:campoEstudioId/examenes", verificarDocente, async (req, res) => {
    const campoEstudioId = req.params.campoEstudioId;

    try {
        const campoRef = db.collection("campos_estudio").doc(campoEstudioId);
        const campoSnapshot = await campoRef.get();

        if (!campoSnapshot.exists) {
            return res.status(404).json({
                error: "El campo de estudio seleccionado no existe."
            });
        }

        const snapshot = await campoRef.collection("examenes").get();

        const examenes = snapshot.docs.map((documento) => {
            const datos = documento.data();

            return {
                id: documento.id,
                nombre: datos.nombre,
                estado: datos.estado
            };
        }).sort((a, b) =>
            String(a.nombre || "").localeCompare(String(b.nombre || ""), "es")
        );

        return res.status(200).json({ examenes });
    } catch (error) {
        console.error("Error al consultar los examenes del campo de estudio:", error.message);

        return res.status(500).json({
            error: "No se pudieron consultar los examenes."
        });
    }
});
router.post("/campos-estudio", verificarDocente, async (req, res) => {
    const { nombre } = req.body || {};

    if (typeof nombre !== "string" || !nombre.trim()) {
        return res.status(400).json({
            error: "El nombre del campo de estudio es obligatorio."
        });
    }

    try {
        const campoRef = db.collection("campos_estudio").doc();

        await campoRef.create({
            nombre: nombre.trim(),
            creadoPor: req.usuario.uid,
            fechaCreacion: FieldValue.serverTimestamp()
        });

        return res.status(201).json({
            estado: "creado",
            mensaje: "El campo de estudio se creó correctamente.",
            campoEstudioId: campoRef.id,
            nombre: nombre.trim()
        });
    } catch (error) {
        console.error("Error al crear el campo de estudio:", error.message);

        return res.status(500).json({
            error: "No se pudo crear el campo de estudio."
        });
    }
});

router.post("/", verificarDocente, async (req, res) => {
    const {
        nombre,
        descripcion = "",
        campoEstudioId,
        preguntas
    } = req.body || {};

    if (typeof campoEstudioId !== "string" || !campoEstudioId.trim()) {
        return res.status(400).json({
            error: "Debes seleccionar un campo de estudio."
        });
    }

    if (typeof nombre !== "string" || !nombre.trim()) {
        return res.status(400).json({
            error: "El nombre del examen es obligatorio."
        });
    }

    if (typeof descripcion !== "string") {
        return res.status(400).json({
            error: "La descripciÃ³n del examen no es vÃ¡lida."
        });
    }

    if (!Array.isArray(preguntas) || preguntas.length === 0) {
        return res.status(400).json({
            error: "El examen debe contener al menos una pregunta."
        });
    }

    const preguntasValidas = preguntas.every((item) =>
        item &&
        Number.isInteger(item.numeroOriginal) &&
        item.numeroOriginal > 0 &&
        typeof item.tipo === "string" &&
        item.tipo.trim() !== "" &&
        item.pregunta &&
        typeof item.pregunta === "object" &&
        !Array.isArray(item.pregunta)
    );

    if (!preguntasValidas) {
        return res.status(400).json({
            error: "Una o mÃ¡s preguntas tienen una estructura invÃ¡lida."
        });
    }

    let examenRef = null;
    let referenciasPreguntas = [];

    try {
        const campoRef = db.collection("campos_estudio").doc(campoEstudioId.trim());
        const campoSnapshot = await campoRef.get();

        if (!campoSnapshot.exists) {
            return res.status(400).json({
                error: "El campo de estudio seleccionado no existe."
            });
        }

        examenRef = campoRef.collection("examenes").doc();

        referenciasPreguntas = preguntas.map(() =>
            examenRef.collection("preguntas").doc()
        );

        await examenRef.create({
            nombre: nombre.trim(),
            descripcion: descripcion.trim(),
            campoEstudioId: campoRef.id,
            estado: "borrador",
            creadoPor: req.usuario.uid,
            fechaCreacion: FieldValue.serverTimestamp()
        });

        for (let inicio = 0; inicio < preguntas.length; inicio += 450) {
            const lote = db.batch();
            const fin = Math.min(inicio + 450, preguntas.length);

            for (let i = inicio; i < fin; i++) {
                const item = preguntas[i];

                lote.create(referenciasPreguntas[i], {
                    numeroOriginal: item.numeroOriginal,
                    tipo: item.tipo,
                    pregunta: item.pregunta,
                    estado: "activa"
                });
            }

            await lote.commit();
        }

        return res.status(201).json({
            estado: "creado",
            mensaje: "El examen y sus preguntas se guardaron correctamente.",
            examenId: examenRef.id,
            campoEstudioId: campoRef.id,
            totalPreguntas: preguntas.length
        });
    } catch (error) {
        console.error("Error al guardar el examen:", error.message);

        if (examenRef) {
            try {
                for (let inicio = 0; inicio < referenciasPreguntas.length; inicio += 450) {
                    const loteLimpieza = db.batch();
                    const fin = Math.min(inicio + 450, referenciasPreguntas.length);

                    for (let i = inicio; i < fin; i++) {
                        loteLimpieza.delete(referenciasPreguntas[i]);
                    }

                    await loteLimpieza.commit();
                }

                await examenRef.delete();
            } catch (errorLimpieza) {
                console.error("Error al revertir el guardado:", errorLimpieza.message);
            }
        }

        return res.status(500).json({
            error: "No se pudo guardar el examen. No se confirmÃ³ la operaciÃ³n."
        });
    }
});


router.get("/campos-estudio/:campoEstudioId/examenes/:examenId/preguntas", verificarDocente, async (req, res) => {
    const { campoEstudioId, examenId } = req.params;

    try {
        const campoRef = db.collection("campos_estudio").doc(campoEstudioId);
        const campoSnapshot = await campoRef.get();

        if (!campoSnapshot.exists) {
            return res.status(404).json({
                error: "El campo de estudio seleccionado no existe."
            });
        }

        const examenRef = campoRef.collection("examenes").doc(examenId);
        const examenSnapshot = await examenRef.get();

        if (!examenSnapshot.exists) {
            return res.status(404).json({
                error: "El examen seleccionado no existe en este campo de estudio."
            });
        }

        const snapshot = await examenRef.collection("preguntas")
            .where("estado", "==", "activa")
            .get();

        const preguntas = snapshot.docs.map((documento) => {
            const datos = documento.data();

            return {
                id: documento.id,
                numeroOriginal: datos.numeroOriginal,
                tipo: datos.tipo,
                pregunta: datos.pregunta
            };
        }).sort((a, b) => a.numeroOriginal - b.numeroOriginal);

        return res.status(200).json({
            totalPreguntas: preguntas.length,
            preguntas
        });
    } catch (error) {
        console.error("Error al consultar las preguntas del examen:", error.message);

        return res.status(500).json({
            error: "No se pudieron consultar las preguntas del examen."
        });
    }
});
router.get("/campos-estudio/:campoEstudioId/examenes/:examenId/configuracion", verificarDocente, async (req, res) => {
    const { campoEstudioId, examenId } = req.params;

    try {
        const campoRef = db.collection("campos_estudio").doc(campoEstudioId);
        const campoSnapshot = await campoRef.get();

        if (!campoSnapshot.exists) {
            return res.status(404).json({
                error: "El campo de estudio seleccionado no existe."
            });
        }

        const examenRef = campoRef.collection("examenes").doc(examenId);
        const examenSnapshot = await examenRef.get();

        if (!examenSnapshot.exists) {
            return res.status(404).json({
                error: "El examen seleccionado no existe en este campo de estudio."
            });
        }

        const datosExamen = examenSnapshot.data();
        const configuracion = datosExamen.configuracion;

        if (!configuracion) {
            return res.status(200).json({
                estado: datosExamen.estado ?? "borrador",
                configuracion: null
            });
        }

        return res.status(200).json({
            estado: datosExamen.estado ?? "borrador",
            configuracion: {
                fechaHoraInicio: configuracion.fechaHoraInicio?.toDate().toISOString() || null,
                fechaHoraFin: configuracion.fechaHoraFin?.toDate().toISOString() || null,
                intentosPermitidos: configuracion.intentosPermitidos ?? null,
                duracionMinutos: configuracion.duracionMinutos ?? null,
                aleatorizarPreguntas: configuracion.aleatorizarPreguntas ?? false,
                aleatorizarRespuestas: configuracion.aleatorizarRespuestas ?? false,
                puntuacion: configuracion.puntuacion ?? null,
                seleccionPreguntas: configuracion.seleccionPreguntas ?? null,
            }
        });
    } catch (error) {
        console.error("Error al consultar la disponibilidad del examen:", error.message);

        return res.status(500).json({
            error: "No se pudo consultar la disponibilidad del examen."
        });
    }
});
router.patch("/campos-estudio/:campoEstudioId/examenes/:examenId/configuracion", verificarDocente, async (req, res) => {
    const { campoEstudioId, examenId } = req.params;
    const {
        fechaHoraInicio,
        fechaHoraFin,
        intentosPermitidos,
        duracionMinutos
    } = req.body || {};

    if (
        typeof fechaHoraInicio !== "string" ||
        typeof fechaHoraFin !== "string" ||
        !fechaHoraInicio.trim() ||
        !fechaHoraFin.trim()
    ) {
        return res.status(400).json({
            error: "Debes proporcionar las fechas de apertura y cierre."
        });
    }

    if (!Number.isInteger(intentosPermitidos) || intentosPermitidos < 1) {
        return res.status(400).json({
            error: "Los intentos permitidos deben ser un entero positivo."
        });
    }

    if (!Number.isInteger(duracionMinutos) || duracionMinutos < 1) {
        return res.status(400).json({
            error: "La duraciÃ³n debe ser un entero positivo en minutos."
        });
    }

    const fechaInicio = new Date(fechaHoraInicio);
    const fechaFin = new Date(fechaHoraFin);

    if (
        Number.isNaN(fechaInicio.getTime()) ||
        Number.isNaN(fechaFin.getTime())
    ) {
        return res.status(400).json({
            error: "Las fechas proporcionadas no son vÃ¡lidas."
        });
    }

    if (fechaFin <= fechaInicio) {
        return res.status(400).json({
            error: "La fecha de cierre debe ser posterior a la fecha de apertura."
        });
    }

    try {
        const campoRef = db.collection("campos_estudio").doc(campoEstudioId);
        const campoSnapshot = await campoRef.get();

        if (!campoSnapshot.exists) {
            return res.status(404).json({
                error: "El campo de estudio seleccionado no existe."
            });
        }

        const examenRef = campoRef.collection("examenes").doc(examenId);
        const examenSnapshot = await examenRef.get();

        if (!examenSnapshot.exists) {
            return res.status(404).json({
                error: "El examen seleccionado no existe en este campo de estudio."
            });
        }

        await examenRef.update({
            "configuracion.fechaHoraInicio": Timestamp.fromDate(fechaInicio),
            "configuracion.fechaHoraFin": Timestamp.fromDate(fechaFin),
            "configuracion.intentosPermitidos": intentosPermitidos,
            "configuracion.duracionMinutos": duracionMinutos
        });

        return res.status(200).json({
            estado: "actualizado",
            mensaje: "La disponibilidad del examen se guardÃ³ correctamente."
        });
    } catch (error) {
        console.error("Error al guardar la disponibilidad del examen:", error.message);

        return res.status(500).json({
            error: "No se pudo guardar la disponibilidad del examen."
        });
    }
});

router.patch("/campos-estudio/:campoEstudioId/examenes/:examenId/configuracion/aleatorizacion", verificarDocente, async (req, res) => {
    const { campoEstudioId, examenId } = req.params;
    const {
        aleatorizarPreguntas,
        aleatorizarRespuestas
    } = req.body || {};

    if (
        typeof aleatorizarPreguntas !== "boolean" ||
        typeof aleatorizarRespuestas !== "boolean"
    ) {
        return res.status(400).json({
            error: "Las opciones de aleatorizaciÃ³n deben ser valores booleanos."
        });
    }

    try {
        const campoRef = db.collection("campos_estudio").doc(campoEstudioId);
        const campoSnapshot = await campoRef.get();

        if (!campoSnapshot.exists) {
            return res.status(404).json({
                error: "El campo de estudio seleccionado no existe."
            });
        }

        const examenRef = campoRef.collection("examenes").doc(examenId);
        const examenSnapshot = await examenRef.get();

        if (!examenSnapshot.exists) {
            return res.status(404).json({
                error: "El examen seleccionado no existe en este campo de estudio."
            });
        }

        await examenRef.update({
            "configuracion.aleatorizarPreguntas": aleatorizarPreguntas,
            "configuracion.aleatorizarRespuestas": aleatorizarRespuestas
        });

        return res.status(200).json({
            estado: "actualizado",
            mensaje: "Las opciones de aleatorizaciÃ³n se guardaron correctamente."
        });
    } catch (error) {
        console.error("Error al guardar la aleatorizaciÃ³n del examen:", error.message);

        return res.status(500).json({
            error: "No se pudieron guardar las opciones de aleatorizaciÃ³n."
        });
    }
});

router.patch("/campos-estudio/:campoEstudioId/examenes/:examenId/configuracion/puntuacion", verificarDocente, async (req, res) => {
    const { campoEstudioId, examenId } = req.params;
    const {
        puntuacionMaxima,
        modalidad,
        valorUniforme,
        valoresIndividuales
    } = req.body || {};

    if (
        typeof puntuacionMaxima !== "number" ||
        !Number.isFinite(puntuacionMaxima) ||
        puntuacionMaxima <= 0
    ) {
        return res.status(400).json({
            error: "La puntuacion maxima debe ser un numero positivo."
        });
    }

    if (!["uniforme", "individual"].includes(modalidad)) {
        return res.status(400).json({
            error: "La modalidad de puntuacion no es valida."
        });
    }

    let puntuacion;

    if (modalidad === "uniforme") {
        if (
            typeof valorUniforme !== "number" ||
            !Number.isFinite(valorUniforme) ||
            valorUniforme <= 0
        ) {
            return res.status(400).json({
                error: "El valor uniforme debe ser un numero positivo."
            });
        }

        puntuacion = {
            puntuacionMaxima,
            modalidad,
            valorUniforme,
            valoresIndividuales: {}
        };
    } else {
        if (
            valoresIndividuales === null ||
            typeof valoresIndividuales !== "object" ||
            Array.isArray(valoresIndividuales)
        ) {
            return res.status(400).json({
                error: "Debes proporcionar los valores individuales de las preguntas."
            });
        }

        for (const valor of Object.values(valoresIndividuales)) {
            if (
                typeof valor !== "number" ||
                !Number.isFinite(valor) ||
                valor <= 0
            ) {
                return res.status(400).json({
                    error: "Todos los valores individuales deben ser numeros positivos."
                });
            }
        }

        puntuacion = {
            puntuacionMaxima,
            modalidad,
            valorUniforme: null,
            valoresIndividuales
        };
    }

    try {
        const campoRef = db.collection("campos_estudio").doc(campoEstudioId);
        const campoSnapshot = await campoRef.get();

        if (!campoSnapshot.exists) {
            return res.status(404).json({
                error: "El campo de estudio seleccionado no existe."
            });
        }

        const examenRef = campoRef.collection("examenes").doc(examenId);
        const examenSnapshot = await examenRef.get();

        if (!examenSnapshot.exists) {
            return res.status(404).json({
                error: "El examen seleccionado no existe en este campo de estudio."
            });
        }

        if (modalidad === "individual") {
            const preguntasSnapshot = await examenRef
                .collection("preguntas")
                .where("estado", "==", "activa")
                .get();

            if (preguntasSnapshot.empty) {
                return res.status(400).json({
                    error: "No hay preguntas activas para asignar puntuaciones."
                });
            }

            const idsPreguntasActivas = new Set(
                preguntasSnapshot.docs.map(documento => documento.id)
            );

            const idsConfigurados = Object.keys(valoresIndividuales);

            if (
                idsConfigurados.length !== idsPreguntasActivas.size ||
                idsConfigurados.some(id => !idsPreguntasActivas.has(id))
            ) {
                return res.status(400).json({
                    error: "Debes asignar una puntuacion a todas las preguntas activas del banco, sin incluir preguntas adicionales."
                });
            }
        }

        await examenRef.update({
            "configuracion.puntuacion": puntuacion
        });

        return res.status(200).json({
            estado: "actualizado",
            mensaje: "La puntuacion del examen se guardo correctamente.",
            puntuacion
        });
    } catch (error) {
        console.error("Error al guardar la puntuacion del examen:", error.message);

        return res.status(500).json({
            error: "No se pudo guardar la puntuacion del examen."
        });
    }
});
router.patch("/campos-estudio/:campoEstudioId/examenes/:examenId/configuracion/seleccion-preguntas", verificarDocente, async (req, res) => {
    const { campoEstudioId, examenId } = req.params;

    const {
        cantidadTotal,
        modalidad,
        preguntasSeleccionadas,
        modalidadCombinada,
        preguntasObligatorias
    } = req.body || {};

    if (!Number.isInteger(cantidadTotal) || cantidadTotal <= 0) {
        return res.status(400).json({
            error: "La cantidad total de preguntas debe ser un entero positivo."
        });
    }

    if (!["aleatoria-fija", "aleatoria-estudiante", "manual", "combinada"].includes(modalidad)) {
        return res.status(400).json({
            error: "La modalidad de seleccion de preguntas no es valida."
        });
    }

    try {
        const campoRef = db.collection("campos_estudio").doc(campoEstudioId);
        const campoSnapshot = await campoRef.get();

        if (!campoSnapshot.exists) {
            return res.status(404).json({
                error: "El campo de estudio seleccionado no existe."
            });
        }

        const examenRef = campoRef.collection("examenes").doc(examenId);
        const examenSnapshot = await examenRef.get();

        if (!examenSnapshot.exists) {
            return res.status(404).json({
                error: "El examen seleccionado no existe en este campo de estudio."
            });
        }

        const preguntasSnapshot = await examenRef
            .collection("preguntas")
            .where("estado", "==", "activa")
            .get();

        const idsActivos = new Set(
            preguntasSnapshot.docs.map(documento => documento.id)
        );

        if (cantidadTotal > idsActivos.size) {
            return res.status(400).json({
                error: "La cantidad solicitada supera el numero de preguntas activas disponibles."
            });
        }

        const configuracionActual = examenSnapshot.data().configuracion || {};
        const seleccionAnterior = configuracionActual.seleccionPreguntas || {};

        const mezclar = (elementos) => {
            const resultado = [...elementos];

            for (let i = resultado.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
            }

            return resultado;
        };

        const listaValida = (lista, cantidad) => (
            Array.isArray(lista) &&
            lista.length === cantidad &&
            new Set(lista).size === lista.length &&
            lista.every(id =>
                typeof id === "string" &&
                id.trim().length > 0 &&
                id === id.trim() &&
                idsActivos.has(id)
            )
        );

        const listasIguales = (a, b) => (
            Array.isArray(a) &&
            Array.isArray(b) &&
            a.length === b.length &&
            a.every(id => b.includes(id))
        );

        let seleccionPreguntas;

        if (modalidad === "aleatoria-fija") {
            const seleccionAnteriorValida =
                seleccionAnterior.modalidad === modalidad &&
                seleccionAnterior.cantidadTotal === cantidadTotal &&
                listaValida(seleccionAnterior.preguntasSeleccionadas, cantidadTotal);

            const seleccion = seleccionAnteriorValida
                ? seleccionAnterior.preguntasSeleccionadas
                : mezclar([...idsActivos]).slice(0, cantidadTotal);

            seleccionPreguntas = {
                cantidadTotal,
                modalidad,
                preguntasSeleccionadas: seleccion
            };

        } else if (modalidad === "aleatoria-estudiante") {
            seleccionPreguntas = {
                cantidadTotal,
                modalidad
            };

        } else if (modalidad === "manual") {
            if (!listaValida(preguntasSeleccionadas, cantidadTotal)) {
                return res.status(400).json({
                    error: "Debes seleccionar exactamente la cantidad indicada de preguntas activas, sin repetirlas."
                });
            }

            seleccionPreguntas = {
                cantidadTotal,
                modalidad,
                preguntasSeleccionadas
            };

        } else {
            if (!["fija", "por-estudiante"].includes(modalidadCombinada)) {
                return res.status(400).json({
                    error: "La modalidad combinada no es valida."
                });
            }

            if (
                !Array.isArray(preguntasObligatorias) ||
                preguntasObligatorias.length === 0 ||
                preguntasObligatorias.length >= cantidadTotal ||
                !preguntasObligatorias.every(id =>
                    typeof id === "string" &&
                    id.trim().length > 0 &&
                    id === id.trim() &&
                    idsActivos.has(id)
                ) ||
                new Set(preguntasObligatorias).size !== preguntasObligatorias.length
            ) {
                return res.status(400).json({
                    error: "Debes seleccionar preguntas obligatorias validas, sin repetirlas, y dejar al menos una pregunta para el complemento."
                });
            }

            if (modalidadCombinada === "por-estudiante") {
                seleccionPreguntas = {
                    cantidadTotal,
                    modalidad,
                    modalidadCombinada,
                    preguntasObligatorias
                };

            } else {
                const cantidadComplementarias = cantidadTotal - preguntasObligatorias.length;

                const complementoAnteriorValido =
                    seleccionAnterior.modalidad === "combinada" &&
                    seleccionAnterior.modalidadCombinada === "fija" &&
                    seleccionAnterior.cantidadTotal === cantidadTotal &&
                    listasIguales(
                        seleccionAnterior.preguntasObligatorias,
                        preguntasObligatorias
                    ) &&
                    listaValida(
                        seleccionAnterior.preguntasComplementarias,
                        cantidadComplementarias
                    ) &&
                    seleccionAnterior.preguntasComplementarias.every(
                        id => !preguntasObligatorias.includes(id)
                    );

                const preguntasComplementarias = complementoAnteriorValido
                    ? seleccionAnterior.preguntasComplementarias
                    : mezclar(
                        [...idsActivos].filter(id => !preguntasObligatorias.includes(id))
                    ).slice(0, cantidadComplementarias);

                seleccionPreguntas = {
                    cantidadTotal,
                    modalidad,
                    modalidadCombinada,
                    preguntasObligatorias,
                    preguntasComplementarias
                };
            }
        }

        await examenRef.update({
            "configuracion.seleccionPreguntas": seleccionPreguntas
        });

        return res.status(200).json({
            estado: "actualizado",
            mensaje: "La seleccion de preguntas se guardo correctamente.",
            seleccionPreguntas
        });

    } catch (error) {
        console.error("Error al guardar la seleccion de preguntas:", error.message);

        return res.status(500).json({
            error: "No se pudo guardar la seleccion de preguntas."
        });
    }
});


router.patch("/campos-estudio/:campoEstudioId/examenes/:examenId/estado", verificarDocente, async (req, res) => {
    const { campoEstudioId, examenId } = req.params;
    const { estado } = req.body || {};

    if (!["borrador", "publicado"].includes(estado)) {
        return res.status(400).json({
            error: "El estado debe ser borrador o publicado."
        });
    }

    try {
        const campoRef = db.collection("campos_estudio").doc(campoEstudioId);
        const campoSnapshot = await campoRef.get();

        if (!campoSnapshot.exists) {
            return res.status(404).json({
                error: "El campo de estudio seleccionado no existe."
            });
        }

        const examenRef = campoRef.collection("examenes").doc(examenId);
        const examenSnapshot = await examenRef.get();

        if (!examenSnapshot.exists) {
            return res.status(404).json({
                error: "El examen seleccionado no existe en este campo de estudio."
            });
        }

        await examenRef.update({ estado });

        return res.status(200).json({
            estado,
            mensaje: "El estado del examen se actualizo correctamente."
        });

    } catch (error) {
        console.error("Error al actualizar el estado del examen:", error.message);

        return res.status(500).json({
            error: "No se pudo actualizar el estado del examen."
        });
    }
});

module.exports = router;