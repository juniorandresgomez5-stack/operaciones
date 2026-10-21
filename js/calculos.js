// CÁLCULOS DEL NEGOCIO
// Este módulo no modifica la interfaz ni guarda datos: recibe valores y devuelve resultados.

// Compara lo procesado en un día con la meta diaria del proyecto.
export function calcularCumplimientoDiario(meta, moduladas) {
  const porcentaje = meta > 0 ? (moduladas / meta) * 100 : 0;
  const diferencia = moduladas - meta;
  return {
    porcentaje: Number(porcentaje.toFixed(2)),
    faltantes: Math.max(meta - moduladas, 0),
    excedentes: Math.max(diferencia, 0),
    diferencia,
    cumplida: meta > 0 && moduladas >= meta,
  };
}

// Compara el total procesado acumulado con la meta global del proyecto.
export function calcularCumplimientoGlobal(meta, acumuladas) {
  const porcentaje = meta > 0 ? (acumuladas / meta) * 100 : 0;
  return {
    porcentaje: Number(porcentaje.toFixed(2)),
    faltantes: Math.max(meta - acumuladas, 0),
    cumplida: acumuladas >= meta,
  };
}

// Calcula el inventario esperado y, si se da un conteo físico, su diferencia.
export function calcularInventario(iniciales, recibidas, moduladas, conteoFinal) {
  const esperado = iniciales + recibidas - moduladas;
  return { esperado, real: conteoFinal, diferencia: conteoFinal - esperado };
}

// Devuelve las cajas que quedan: iniciales + recibidas - procesadas.
export function calcularRestantes(iniciales, recibidas, procesadas = 0) {
  return iniciales + recibidas - procesadas;
}

// Suma un campo (por defecto, recibidas) solo dentro del proyecto indicado.
export function calcularAcumuladoProyecto(projectId, records, field = "recibidas") {
  return records
    .filter((record) => Number(record.proyectoId) === Number(projectId))
    .reduce((total, record) => total + Number(record[field] || 0), 0);
}

// Formatea números con separadores habituales en Colombia.
export function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: digits }).format(Number(value) || 0);
}

// Convierte una fecha YYYY-MM-DD en una fecha legible sin desfase por zona horaria.
export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("es-CO", { year: "numeric", month: "short", day: "numeric" }).format(date);
}
