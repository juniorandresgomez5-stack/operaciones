/*
 * CONFIGURACIÓN DE LOS PROYECTOS
 * Cambia aquí los nombres, metas, cajas iniciales y fechas límite de ejemplo.
 * Los id deben ser únicos y mantenerse iguales para conservar el historial guardado.
 * Las metas también se pueden modificar desde la pantalla «Proyectos».
 */
export const proyectos = [
  { id: 1, nombre: "opain", metaGlobal: 50000, fechaLimite: "2026-11-30", metaDiaria: 0, cajasIniciales: 0 },
  { id: 2, nombre: "Repsol", metaGlobal: 40000, fechaLimite: "2026-11-30", metaDiaria: 0, cajasIniciales: 0 },
  { id: 3, nombre: "Hospital militar", metaGlobal: 30000, fechaLimite: "2026-12-15", metaDiaria: 0, cajasIniciales: 0 },
  { id: 4, nombre: "huecos vacios", metaGlobal: 25000, fechaLimite: "2026-12-15", metaDiaria: 0, cajasIniciales: 0 },
  { id: 5, nombre: "moduladas", metaGlobal: 20000, fechaLimite: "2027-01-15", metaDiaria: 0, cajasIniciales: 0 },
  { id: 6, nombre: "dia a dia ", metaGlobal: 15000, fechaLimite: "2027-01-15", metaDiaria: 0, cajasIniciales: 0 },
];

// Ajustes generales de la aplicación; «local» significa que guarda datos en este navegador.
export const APP_CONFIG = {
  appName: "Analítica de proyectos",
  database: { provider: "local" },
};
