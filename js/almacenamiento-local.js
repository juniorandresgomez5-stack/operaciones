import { proyectos } from "./configuracion-proyectos.js";

// Si cambias esta clave, el navegador verá el almacenamiento como una base de datos nueva.
const CLAVE_REGISTROS = "analitica_cajas_registros";

// Datos que se usan la primera vez que se abre la app o si el almacenamiento está vacío.
function datosIniciales() {
  return {
    projects: structuredClone(proyectos),
    projectRecords: [],
    modulationRecords: [],
  };
}

// Lee localStorage y normaliza registros viejos para que sigan funcionando.
function leerDatos() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CLAVE_REGISTROS) || "null");
    if (!parsed || typeof parsed !== "object") return datosIniciales();
    const savedProjects = Array.isArray(parsed.projects) ? parsed.projects : [];
    const projects = proyectos.map((base) => ({
      ...base,
      ...(savedProjects.find((item) => Number(item.id) === base.id) || {}),
    }));
    const projectRecords = Array.isArray(parsed.projectRecords) ? parsed.projectRecords.map((record, index) => ({
      ...record,
      id: record.id || `legacy-${record.proyectoId}-${record.fecha}-${index}`,
      procesadas: Number(record.procesadas || 0),
      nombreProyectoSnapshot: record.nombreProyectoSnapshot || projects.find((project) => Number(project.id) === Number(record.proyectoId))?.nombre || `Proyecto ${record.proyectoId}`,
      metaDiariaSnapshot: Number(record.metaDiariaSnapshot ?? record.metaDiaria ?? projects.find((project) => Number(project.id) === Number(record.proyectoId))?.metaDiaria ?? 0),
      metaGlobalSnapshot: Number(record.metaGlobalSnapshot ?? projects.find((project) => Number(project.id) === Number(record.proyectoId))?.metaGlobal ?? 0),
      createdAt: record.createdAt || `${record.fecha || "1970-01-01"}T12:00:00.000Z`,
    })) : [];
    return {
      projects,
      projectRecords,
      // Se conserva cualquier historial previo para no borrarlo al cambiar el modelo.
      modulationRecords: Array.isArray(parsed.modulationRecords) ? parsed.modulationRecords : [],
    };
  } catch (error) {
    console.error("No fue posible leer los datos locales:", error);
    return datosIniciales();
  }
}

// Serializa el estado completo y lo guarda en el navegador actual.
function escribirDatos(data) {
  localStorage.setItem(CLAVE_REGISTROS, JSON.stringify(data));
}

// API de compatibilidad para las antiguas modulaciones globales.
// Lee los registros del formato antiguo para que otras pantallas puedan consultarlos.
export function obtenerRegistros() {
  return leerDatos().modulationRecords;
}

// Compatibilidad con registros globales de versiones anteriores; mantiene un registro por fecha.
// Guarda o reemplaza el registro antiguo asociado con una fecha.
export function guardarRegistro(nuevoRegistro) {
  const data = leerDatos();
  const index = data.modulationRecords.findIndex((record) => record.fecha === nuevoRegistro.fecha);
  if (index >= 0) data.modulationRecords[index] = nuevoRegistro;
  else data.modulationRecords.push(nuevoRegistro);
  escribirDatos(data);
  return nuevoRegistro;
}

// Repositorio local: las pantallas llaman a estos métodos sin depender directamente de localStorage.
export class LocalRepository {
  // Devuelve proyectos y movimientos listos para usar.
  // Punto de lectura usado al iniciar la app y después de cada cambio.
  async getAll() {
    return leerDatos();
  }

  // Actualiza solo la configuración del proyecto seleccionado.
  // Persiste la configuración editada de un solo proyecto.
  async saveProject(project) {
    const data = leerDatos();
    data.projects = data.projects.map((item) => Number(item.id) === Number(project.id) ? { ...item, ...project } : item);
    escribirDatos(data);
    return project;
  }

  // Añade un movimiento nuevo; no reemplaza otros movimientos del mismo día.
  // Persiste una entrada nueva de recibidas/procesadas como evidencia independiente.
  async saveProjectRecord(record) {
    const data = leerDatos();
    data.projectRecords.push(record);
    escribirDatos(data);
    return record;
  }

  // Conserva compatibilidad con la antigua pantalla de modulación.
  // Redirige las escrituras antiguas al método de compatibilidad.
  async saveModulationRecord(record) {
    return guardarRegistro(record);
  }
}

// Punto de creación del repositorio. Si luego se conecta una base de datos, puede sustituirse aquí.
export function createRepository() {
  return new LocalRepository();
}
