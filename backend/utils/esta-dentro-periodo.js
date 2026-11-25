function estaDentroPeriodo(ahora, inicio, fin) {
    if (
        !Number.isFinite(ahora) ||
        !Number.isFinite(inicio) ||
        !Number.isFinite(fin) ||
        inicio >= fin
    ) {
        return false;
    }

    return ahora >= inicio && ahora < fin;
}

module.exports = estaDentroPeriodo;