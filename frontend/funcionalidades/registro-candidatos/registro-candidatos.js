const formulario = document.getElementById("formulario-candidato");
const botonEnviar = document.getElementById("enviar-candidato");

const API_CANDIDATOS = "https://examenes-002h.onrender.com/api/publico/candidatos";

const mensajeEstado = document.createElement("p");
mensajeEstado.id = "mensaje-estado-candidato";
mensajeEstado.setAttribute("role", "status");
mensajeEstado.setAttribute("aria-live", "polite");

formulario.appendChild(mensajeEstado);

formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    if (!formulario.reportValidity()) {
        return;
    }

    const datos = {
        nombres: formulario.nombres.value.trim().replace(/\s+/g, " "),
        apellidos: formulario.apellidos.value.trim().replace(/\s+/g, " "),
        cedula: formulario.cedula.value.trim(),
        correoElectronico: formulario.correoElectronico.value.trim().toLowerCase()
    };

    botonEnviar.disabled = true;
    botonEnviar.textContent = "Enviando solicitud...";
    mensajeEstado.textContent = "";
    mensajeEstado.style.color = "";

    try {
        const respuesta = await fetch(API_CANDIDATOS, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(datos)
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                resultado.error || "No se pudo enviar la solicitud."
            );
        }

        mensajeEstado.textContent =
            "¡Solicitud enviada correctamente! Tus datos serán revisados por el personal docente.";

        mensajeEstado.style.color = "#178a75";

        formulario.reset();

    } catch (error) {
        console.error("Error al enviar la solicitud:", error);

        mensajeEstado.textContent =
            error.message === "Failed to fetch"
                ? "No fue posible conectar con el servidor. Inténtalo nuevamente."
                : error.message;

        mensajeEstado.style.color = "#b42318";

    } finally {
        botonEnviar.disabled = false;
        botonEnviar.innerHTML = 'Enviar solicitud <span>→</span>';
    }
});
