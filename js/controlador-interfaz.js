import { createRepository } from "./almacenamiento-local.js";
import { calcularCumplimientoDiario, calcularCumplimientoGlobal, calcularAcumuladoProyecto, calcularRestantes, formatNumber, formatDate } from "./calculos.js";

// CONTROLADOR PRINCIPAL DE LA INTERFAZ
// Aquí se conectan los datos con las pantallas de index.html. Los estilos y el marcado fijo
// están en HTML/CSS; este archivo escucha acciones, calcula resultados y actualiza valores.
const repository = createRepository();
// Atajos para buscar elementos HTML: $ devuelve uno; $$ devuelve una lista.
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// Clona una plantilla HTML para crear tarjetas y filas con datos reales.
function cloneTemplate(selector) {
  return $(selector).content.firstElementChild.cloneNode(true);
}
// Actualiza solo el texto de un elemento dentro de una tarjeta clonada.
function setText(element, selector, value) {
  $(selector, element).textContent = value;
}
// Crea una fila de tabla con texto seguro; cellClasses permite destacar estados como cumplimiento.
function makeTableRow(values, cellClasses = []) {
  const row = document.createElement("tr");
  values.forEach((value, index) => {
    const cell = document.createElement("td");
    cell.textContent = value;
    if (cellClasses[index]) cell.className = cellClasses[index];
    row.append(cell);
  });
  return row;
}
// Muestra filas o una fila de explicación cuando el filtro no devuelve resultados.
function renderTableRows(selector, rows, colspan, emptyMessage) {
  const body = $(selector);
  if (rows.length) {
    body.replaceChildren(...rows);
    return;
  }
  const emptyCell = document.createElement("td");
  emptyCell.colSpan = colspan;
  emptyCell.className = "empty-state";
  emptyCell.textContent = emptyMessage;
  const emptyRow = document.createElement("tr");
  emptyRow.append(emptyCell);
  body.replaceChildren(emptyRow);
}
let currentData = { projects: [], projectRecords: [] };
let toastTimer;

// Devuelve la fecha local actual con el formato que esperan los campos de tipo date.
function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
// Escapa texto dinámico antes de insertarlo en el SVG de los gráficos.
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
// Muestra una notificación temporal; el tiempo de aparición se cambia aquí.
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}
// Cambia la sección visible y el título del encabezado.
function setView(name) {
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${name}`));
  $$(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  const titles = { dashboard: "Resumen general", projects: "Proyectos", daily: "Registro diario", charts: "Gráficos diarios", history: "Historial" };
  $("#page-title").textContent = titles[name] || "Analítica";
}
// Suma un campo histórico (recibidas o procesadas) solo para el proyecto indicado.
function getProjectTotal(projectId, field) {
  return calcularAcumuladoProyecto(projectId, currentData.projectRecords, field);
}
// Filtra movimientos por proyecto y, opcionalmente, por fecha exacta.
function getProjectRecords(projectId, date = null) {
  return currentData.projectRecords.filter((record) => Number(record.proyectoId) === Number(projectId) && (!date || record.fecha === date));
}
// Resume los movimientos de un proyecto en una fecha; varios registros se suman en un solo día.
function summarizeDay(project, date) {
  const records = getProjectRecords(project.id, date);
  const received = records.reduce((sum, record) => sum + Number(record.recibidas || 0), 0);
  const processed = records.reduce((sum, record) => sum + Number(record.procesadas || 0), 0);
  const goal = Number(records[0]?.metaDiariaSnapshot ?? records[0]?.metaDiaria ?? project.metaDiaria ?? 0);
  return { records, received, processed, goal };
}
// Calcula las existencias a una fecha específica para mostrar el saldo histórico correcto.
function getRemaining(project, untilDate = null) {
  const records = getProjectRecords(project.id).filter((record) => !untilDate || record.fecha <= untilDate);
  const received = records.reduce((sum, record) => sum + Number(record.recibidas || 0), 0);
  const processed = records.reduce((sum, record) => sum + Number(record.procesadas || 0), 0);
  return calcularRestantes(Number(project.cajasIniciales || 0), received, processed);
}
// Estima cuántas cajas por día harían falta para alcanzar la meta global antes del vencimiento.
function requiredDailyPace(project, faltantes) {
  if (faltantes <= 0 || !project.fechaLimite) return 0;
  const today = new Date(`${todayLocal()}T12:00:00`);
  const deadline = new Date(`${project.fechaLimite}T12:00:00`);
  const daysLeft = Math.max(1, Math.ceil((deadline - today) / 86400000));
  return faltantes / daysLeft;
}
// Rellena los selectores con los nombres actuales y conserva la selección si todavía existe.
function fillProjectSelectors() {
  const recordSelect = $("#project-record-project");
  const previousProject = recordSelect.value;
  const projectOptions = currentData.projects.map((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.nombre;
    return option;
  });
  recordSelect.replaceChildren(...projectOptions.map((option) => option.cloneNode(true)));
  if (currentData.projects.some((project) => String(project.id) === previousProject)) recordSelect.value = previousProject;
  const history = $("#history-project");
  const selected = history.value;
  const allProjects = document.createElement("option");
  allProjects.value = "";
  allProjects.textContent = "Todos los proyectos";
  history.replaceChildren(allProjects, ...projectOptions.map((option) => option.cloneNode(true)));
  history.value = selected;
  const chartProject = $("#chart-project");
  const previousChartProject = chartProject.value;
  chartProject.replaceChildren(...projectOptions.map((option) => option.cloneNode(true)));
  if (currentData.projects.some((project) => String(project.id) === previousChartProject)) chartProject.value = previousChartProject;
}
// Usa una plantilla HTML y completa los datos de resumen o los campos editables del proyecto.
// Para cambiar el diseño de las tarjetas, edita los templates en index.html y sus reglas CSS.
function projectCard(project, editable = false, date = todayLocal()) {
  const received = getProjectTotal(project.id, "recibidas");
  const processed = getProjectTotal(project.id, "procesadas");
  const remaining = getRemaining(project);
  const globalGoal = Number(project.metaGlobal || 0);
  const global = calcularCumplimientoGlobal(globalGoal, processed);
  const daily = summarizeDay(project, date);
  const dailyResult = calcularCumplimientoDiario(daily.goal, daily.processed);
  const card = cloneTemplate(editable ? "#project-editor-template" : "#project-card-template");
  const badge = $("[data-bind='daily-badge']", card);
  setText(card, "[data-bind='avatar']", String(project.id).padStart(2, "0"));
  badge.classList.add(daily.goal > 0 && dailyResult.cumplida ? "pill-active" : "pill-pending");
  badge.textContent = daily.goal > 0 ? `${formatNumber(dailyResult.porcentaje, 1)}% de meta diaria` : "Configura meta diaria";
  if (!editable) setText(card, "[data-bind='project-name']", project.nombre);
  setText(card, "[data-bind='received']", formatNumber(received));
  setText(card, "[data-bind='processed']", formatNumber(processed));
  setText(card, "[data-bind='remaining']", formatNumber(remaining));
  setText(card, "[data-bind='daily-label']", `Procesadas ${formatDate(date)} / meta diaria`);
  setText(card, "[data-bind='daily-total']", `${formatNumber(daily.processed)} / ${formatNumber(daily.goal)}`);
  if (editable) {
    const form = $(".project-config-form", card);
    form.dataset.projectId = project.id;
    form.elements.nombre.value = project.nombre;
    form.elements.cajasIniciales.value = Number(project.cajasIniciales || 0);
    form.elements.metaDiaria.value = Number(project.metaDiaria || 0);
    form.elements.metaGlobal.value = globalGoal;
    form.elements.fechaLimite.value = project.fechaLimite || "";
  } else {
    setText(card, "[data-bind='global-caption']", `Avance meta global: ${formatNumber(processed)} / ${formatNumber(globalGoal)}`);
    setText(card, "[data-bind='global-percent']", `${formatNumber(global.porcentaje, 1)}%`);
    $("[data-bind='global-progress']", card).style.width = `${Math.min(global.porcentaje, 100)}%`;
    setText(card, "[data-bind='global-missing']", `Faltan ${formatNumber(global.faltantes)}`);
    setText(card, "[data-bind='deadline']", `Vence ${formatDate(project.fechaLimite)}`);
    setText(card, "[data-bind='required-pace']", `Ritmo requerido: ${formatNumber(requiredDailyPace(project, global.faltantes), 1)}/día`);
  }
  return card;
}
// Actualiza indicadores generales, tarjetas y barras comparativas del resumen.
// El ancho de cada barra se normaliza respecto al valor mayor para comparar proyectos.
function renderDashboard() {
  const received = currentData.projectRecords.reduce((sum, record) => sum + Number(record.recibidas || 0), 0);
  const processed = currentData.projectRecords.reduce((sum, record) => sum + Number(record.procesadas || 0), 0);
  const remaining = currentData.projects.reduce((sum, project) => sum + getRemaining(project), 0);
  const globalShortfall = currentData.projects.reduce((sum, project) => sum + Math.max(Number(project.metaGlobal || 0) - getProjectTotal(project.id, "procesadas"), 0), 0);
  $("#metric-projects").textContent = formatNumber(currentData.projects.length);
  $("#metric-received").textContent = formatNumber(received);
  $("#metric-processed").textContent = formatNumber(processed);
  $("#metric-remaining").textContent = formatNumber(remaining);
  $("#metric-global-shortfall").textContent = formatNumber(globalShortfall);
  $("#dashboard-projects").replaceChildren(...currentData.projects.map((project) => projectCard(project)));
  const chartScale = Math.max(1, ...currentData.projects.map((project) => Math.max(getProjectTotal(project.id, "recibidas"), getProjectTotal(project.id, "procesadas"))));
  const rows = currentData.projects.map((project) => {
    const receivedCount = getProjectTotal(project.id, "recibidas");
    const processedCount = getProjectTotal(project.id, "procesadas");
    const row = cloneTemplate("#project-bar-row-template");
    setText(row, "[data-bind='project-name']", project.nombre);
    setText(row, "[data-bind='received']", formatNumber(receivedCount));
    setText(row, "[data-bind='processed']", formatNumber(processedCount));
    $("[data-bind='received-bar']", row).style.width = `${Math.min(receivedCount / chartScale * 100, 100)}%`;
    $("[data-bind='processed-bar']", row).style.width = `${Math.min(processedCount / chartScale * 100, 100)}%`;
    return row;
  });
  $("#project-chart").replaceChildren(...rows);
}
// Dibuja las tarjetas con campos editables para cambiar nombre, metas o fecha límite.
function renderProjects() {
  $("#all-projects").replaceChildren(...currentData.projects.map((project) => projectCard(project, true)));
}
// Dibuja el estado de todos los proyectos para la fecha elegida en el formulario diario.
function renderDailySummary() {
  const date = $("#project-record-form").elements.fecha.value || todayLocal();
  $("#daily-project-summary").replaceChildren(...currentData.projects.map((project) => projectCard(project, false, date)));
}
// Convierte una fecha del registro en una etiqueta corta para los ejes de los gráficos.
function chartDateLabel(date) {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
}
// Dibuja un gráfico SVG de líneas. Los parámetros controlan unidades, escala, referencia y etiquetas.
// Modifica aquí los márgenes o la cantidad de marcas del eje si quieres cambiar su presentación.
function renderLineChart(container, dates, series, { percent = false, targetLine = null, targetLabel = "Meta 100%", pointLabels = false, emptyMessage = "No hay valores para graficar." } = {}) {
  if (!dates.length) {
    container.innerHTML = '<div class="empty-state">No hay registros en el periodo seleccionado.</div>';
    return;
  }
  if (!series.some((item) => item.values.some((value) => Number.isFinite(value)))) {
    container.innerHTML = `<div class="empty-state">${escapeHTML(emptyMessage)}</div>`;
    return;
  }
  const width = 900;
  const height = 330;
  // Márgenes del SVG: aumentarlos deja más espacio para títulos y fechas de los ejes.
  const margin = { top: 22, right: 24, bottom: 58, left: 68 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const allValues = series.flatMap((item) => item.values).filter((value) => Number.isFinite(value));
  if (targetLine !== null) allValues.push(targetLine);
  const dataMax = Math.max(...allValues, percent ? 100 : 1);
  // Redondea el límite vertical para que los ejes tengan una escala fácil de leer.
  const maxY = percent ? Math.max(100, Math.ceil(dataMax / 25) * 25) : Math.max(4, Math.ceil(dataMax / 4) * 4);
  // Estas funciones convierten cada dato a coordenadas dentro del área dibujable.
  const xAt = (index) => dates.length === 1 ? margin.left + plotWidth / 2 : margin.left + (index / (dates.length - 1)) * plotWidth;
  const yAt = (value) => margin.top + plotHeight - (Math.max(0, value) / maxY) * plotHeight;
  const tickCount = 4;
  const grid = Array.from({ length: tickCount + 1 }, (_, index) => {
    const value = maxY * index / tickCount;
    const y = yAt(value);
    return `<g class="chart-tick"><line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"/><text x="${margin.left - 10}" y="${y + 4}" text-anchor="end">${formatNumber(value, 0)}${percent ? "%" : ""}</text></g>`;
  }).join("");
  const labelStep = Math.max(1, Math.ceil(dates.length / 8));
  const labels = dates.map((date, index) => (index % labelStep === 0 || index === dates.length - 1)
    ? `<text class="chart-x-label" x="${xAt(index)}" y="${height - 22}" text-anchor="middle">${escapeHTML(chartDateLabel(date))}</text>` : "").join("");
  // La referencia punteada se usa para marcar el 100 % de la meta global.
  const target = targetLine === null ? "" : `<line class="chart-target-line" x1="${margin.left}" y1="${yAt(targetLine)}" x2="${width - margin.right}" y2="${yAt(targetLine)}"/>`;
  const seriesMarkup = series.map((item, seriesIndex) => {
    const segments = [];
    let segment = [];
    item.values.forEach((value, index) => {
      if (Number.isFinite(value)) segment.push(`${xAt(index)},${yAt(value)}`);
      else if (segment.length) { segments.push(segment); segment = []; }
    });
    if (segment.length) segments.push(segment);
    const lines = segments.filter((points) => points.length > 1).map((points) => `<polyline fill="none" stroke="${item.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${points.join(" ")}"/>`).join("");
    const circles = item.values.map((value, index) => Number.isFinite(value)
      ? `<circle cx="${xAt(index)}" cy="${yAt(value)}" r="4.5" fill="${item.color}" stroke="white" stroke-width="2"><title>${escapeHTML(dates[index])}: ${formatNumber(value, percent ? 1 : 0)}${percent ? "%" : " cajas"}</title></circle>` : "").join("");
    const labels = pointLabels && dates.length <= 10 ? item.values.map((value, index) => Number.isFinite(value)
      ? `<text class="chart-point-label" x="${xAt(index)}" y="${yAt(value) - 10 - seriesIndex * 2}" text-anchor="middle" fill="${item.color}">${formatNumber(value, 1)}${percent ? "%" : ""}</text>` : "").join("") : "";
    return `${lines}${circles}${labels}`;
  }).join("");
  const legend = series.map((item) => `<span><i style="background:${item.color}"></i>${escapeHTML(item.name)}</span>`).join("")
    + (targetLine === null ? "" : `<span><i class="legend-target"></i>${escapeHTML(targetLabel)}</span>`);
  const yAxisTitle = percent ? "Porcentaje (%)" : "Cajas";
  const yTitle = `<text class="chart-y-title" x="17" y="${margin.top + plotHeight / 2}" transform="rotate(-90 17 ${margin.top + plotHeight / 2})" text-anchor="middle">${yAxisTitle}</text>`;
  container.innerHTML = `<svg class="line-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico de líneas por día">${grid}${yTitle}<line class="chart-axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}"/><line class="chart-axis" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"/>${target}${seriesMarkup}${labels}</svg><div class="line-chart-legend">${legend}</div>`;
}
// Dibuja dos barras por día: meta y procesadas. El color de procesadas depende del cumplimiento.
// El porcentaje se calcula como procesadas / meta diaria * 100 y queda bajo cada fecha.
function renderDailyBars(container, groups) {
  if (!groups.length) {
    container.innerHTML = '<div class="empty-state">No hay registros en el periodo seleccionado.</div>';
    return;
  }
  const width = Math.max(900, groups.length * 86);
  const height = 350;
  // Se amplía el SVG cuando hay muchas fechas para que las etiquetas no se monten.
  const margin = { top: 22, right: 24, bottom: 76, left: 68 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(1, ...groups.flatMap((group) => [group.metaDiaria, group.procesadas]));
  const maxY = Math.max(4, Math.ceil(maxValue / 4) * 4);
  const yAt = (value) => margin.top + plotHeight - (Math.max(0, value) / maxY) * plotHeight;
  const clusterWidth = plotWidth / groups.length;
  const barWidth = Math.max(2, Math.min(24, clusterWidth * 0.28));
  const gap = Math.max(1, Math.min(7, clusterWidth * 0.08));
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = maxY * index / 4;
    const y = yAt(value);
    return `<g class="chart-tick"><line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"/><text x="${margin.left - 10}" y="${y + 4}" text-anchor="end">${formatNumber(value, 0)}</text></g>`;
  }).join("");
  const bars = groups.map((group, index) => {
    const center = margin.left + clusterWidth * (index + 0.5);
    const goalX = center - gap / 2 - barWidth;
    const processedX = center + gap / 2;
    const goalY = yAt(group.metaDiaria);
    const processedY = yAt(group.procesadas);
    const goalHeight = Math.max(0, margin.top + plotHeight - goalY);
    const processedHeight = Math.max(0, margin.top + plotHeight - processedY);
    const statusClass = group.metaDiaria <= 0 ? "bar-no-goal" : group.procesadas < group.metaDiaria ? "bar-below" : group.procesadas === group.metaDiaria ? "bar-met" : "bar-exceeded";
    const compliance = group.metaDiaria > 0 ? group.procesadas / group.metaDiaria * 100 : null;
    const resultText = group.metaDiaria <= 0 ? "sin meta diaria configurada" : group.procesadas < group.metaDiaria
      ? `cumplimiento ${formatNumber(compliance, 1)}%; faltan ${formatNumber(group.metaDiaria - group.procesadas)} cajas`
      : group.procesadas === group.metaDiaria ? `cumplimiento ${formatNumber(compliance, 1)}%; meta cumplida`
        : `cumplimiento ${formatNumber(compliance, 1)}%; excedente de ${formatNumber(group.procesadas - group.metaDiaria)} cajas`;
    const goalBar = `<rect class="bar-goal" x="${goalX}" y="${goalY}" width="${barWidth}" height="${goalHeight}" rx="3"><title>${escapeHTML(group.fecha)} · Meta diaria: ${formatNumber(group.metaDiaria)} cajas</title></rect>`;
    const processedBar = `<rect class="${statusClass}" x="${processedX}" y="${processedY}" width="${barWidth}" height="${processedHeight}" rx="3"><title>${escapeHTML(group.fecha)} · Procesadas: ${formatNumber(group.procesadas)} cajas · ${escapeHTML(resultText)}</title></rect>`;
    const valueLabels = `<text class="chart-point-label" x="${goalX + barWidth / 2}" y="${Math.max(14, goalY - 7)}" text-anchor="middle">${formatNumber(group.metaDiaria)}</text><text class="chart-point-label" x="${processedX + barWidth / 2}" y="${Math.max(14, processedY - 7)}" text-anchor="middle">${formatNumber(group.procesadas)}</text><text class="bar-percent-label ${statusClass}" x="${center}" y="${height - 15}" text-anchor="middle">${compliance === null ? "Sin meta" : `${formatNumber(compliance, 1)}%`}</text>`;
    return `${goalBar}${processedBar}${valueLabels}`;
  }).join("");
  const labels = groups.map((group, index) => `<text class="chart-x-label" x="${margin.left + clusterWidth * (index + 0.5)}" y="${height - 40}" text-anchor="middle">${escapeHTML(chartDateLabel(group.fecha))}</text>`).join("");
  const yTitle = `<text class="chart-y-title" x="17" y="${margin.top + plotHeight / 2}" transform="rotate(-90 17 ${margin.top + plotHeight / 2})" text-anchor="middle">Cajas</text>`;
  const legend = '<span><i class="bar-legend-goal"></i>Meta diaria</span><span><i class="bar-legend-below"></i>Por debajo</span><span><i class="bar-legend-met"></i>Meta cumplida</span><span><i class="bar-legend-exceeded"></i>Meta superada</span><span><i class="bar-legend-no-goal"></i>Sin meta configurada</span>';
  container.innerHTML = `<svg class="line-chart-svg daily-bar-svg" width="${width}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Barras diarias de meta, cajas procesadas y porcentaje de cumplimiento">${grid}${yTitle}<line class="chart-axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}"/><line class="chart-axis" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"/>${bars}${labels}</svg><div class="line-chart-legend bar-chart-legend">${legend}<span><i class="bar-legend-percent"></i>% de cumplimiento bajo cada fecha</span></div>`;
}
// Aplica los filtros, calcula indicadores del periodo y actualiza barras, línea global y tabla.
// La curva global suma también las cajas anteriores a la fecha inicial del filtro.
function renderCharts() {
  const project = currentData.projects.find((item) => Number(item.id) === Number($("#chart-project").value));
  if (!project) return;
  const from = $("#chart-from").value;
  const to = $("#chart-to").value;
  const groups = dailyGroups(getProjectRecords(project.id)
    .filter((record) => (!from || record.fecha >= from) && (!to || record.fecha <= to)))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const dates = groups.map((group) => group.fecha);
  const totalReceived = groups.reduce((sum, group) => sum + group.recibidas, 0);
  const totalProcessed = groups.reduce((sum, group) => sum + group.procesadas, 0);
  // El porcentaje del periodo compara todas las procesadas con la suma de las metas diarias.
  const totalDailyGoal = groups.reduce((sum, group) => sum + group.metaDiaria, 0);
  const periodPercent = totalDailyGoal > 0 ? totalProcessed / totalDailyGoal * 100 : null;
  $("#chart-total-received").textContent = formatNumber(totalReceived);
  $("#chart-total-processed").textContent = formatNumber(totalProcessed);
  $("#chart-period-compliance").textContent = periodPercent === null ? "—" : `${formatNumber(periodPercent, 1)}%`;
  $("#chart-period-compliance-note").textContent = totalDailyGoal > 0 ? `${formatNumber(totalProcessed)} de ${formatNumber(totalDailyGoal)} cajas objetivo` : "No hay metas diarias en el periodo";
  renderDailyBars($("#daily-goal-bars"), groups);
  let cumulativeProcessed = currentData.projectRecords
    .filter((record) => Number(record.proyectoId) === Number(project.id) && from && record.fecha < from)
    .reduce((sum, record) => sum + Number(record.procesadas || 0), 0);
  const globalValues = groups.map((group) => {
    cumulativeProcessed += group.procesadas;
    return group.metaGlobal > 0 ? cumulativeProcessed / group.metaGlobal * 100 : null;
  });
  renderLineChart($("#global-percent-chart"), dates, [
    { name: "Avance global acumulado", color: "#16835d", values: globalValues },
  ], { percent: true, targetLine: 100, targetLabel: "Meta global 100%", pointLabels: true, emptyMessage: "Define una meta global para calcular el avance porcentual." });
  const lastGroup = groups.at(-1);
  const lastGlobalPercent = globalValues.at(-1);
  const lastGlobalMissing = lastGroup ? Math.max(lastGroup.metaGlobal - cumulativeProcessed, 0) : null;
  $("#chart-global-progress").textContent = lastGlobalPercent === null || lastGlobalPercent === undefined ? "—" : `${formatNumber(lastGlobalPercent, 1)}%`;
  $("#chart-global-progress-note").textContent = lastGroup
    ? `${formatNumber(cumulativeProcessed)} / ${formatNumber(lastGroup.metaGlobal)} · faltan ${formatNumber(lastGlobalMissing)}`
    : "No hay registros en el periodo";
  const tableRows = groups.map((group) => {
    const daily = calcularCumplimientoDiario(group.metaDiaria, group.procesadas);
    const processedThroughDate = currentData.projectRecords
      .filter((record) => Number(record.proyectoId) === Number(project.id) && record.fecha <= group.fecha)
      .reduce((sum, record) => sum + Number(record.procesadas || 0), 0);
    const global = calcularCumplimientoGlobal(group.metaGlobal, processedThroughDate);
    const dailyDifference = group.procesadas < group.metaDiaria ? `${formatNumber(daily.faltantes)} faltan` : group.procesadas === group.metaDiaria ? "Meta cumplida" : `+${formatNumber(group.procesadas - group.metaDiaria)} excedente`;
    return makeTableRow([
      formatDate(group.fecha), formatNumber(group.recibidas), formatNumber(group.procesadas),
      formatNumber(group.metaDiaria), group.metaDiaria > 0 ? `${formatNumber(daily.porcentaje, 1)}%` : "Sin meta",
      group.metaDiaria > 0 ? dailyDifference : "—", formatNumber(processedThroughDate),
      group.metaGlobal > 0 ? `${formatNumber(global.porcentaje, 1)}%` : "Sin meta", formatNumber(global.faltantes),
    ]);
  });
  renderTableRows("#chart-data-body", tableRows, 9, "No hay datos para el proyecto y periodo seleccionado.");
}
// Agrupa movimientos por proyecto y fecha para evitar duplicar días en tablas y gráficos.
function dailyGroups(records) {
  const groups = new Map();
  records.forEach((record) => {
    const key = `${record.proyectoId}|${record.fecha}`;
    if (!groups.has(key)) {
      groups.set(key, {
        proyectoId: Number(record.proyectoId),
        fecha: record.fecha,
        nombreProyecto: record.nombreProyectoSnapshot || currentData.projects.find((p) => Number(p.id) === Number(record.proyectoId))?.nombre || `Proyecto ${record.proyectoId}`,
        metaDiaria: Number(record.metaDiariaSnapshot ?? record.metaDiaria ?? 0),
        metaGlobal: Number(record.metaGlobalSnapshot ?? 0),
        recibidas: 0,
        procesadas: 0,
        records: [],
      });
    }
    const group = groups.get(key);
    group.recibidas += Number(record.recibidas || 0);
    group.procesadas += Number(record.procesadas || 0);
    group.records.push(record);
  });
  return [...groups.values()].sort((a, b) => b.fecha.localeCompare(a.fecha) || a.proyectoId - b.proyectoId);
}
// Aplica filtros de historial y presenta resumen por día y evidencia de cada movimiento.
function renderHistory() {
  const projectFilter = $("#history-project").value;
  const dateFilter = $("#history-date").value;
  const records = currentData.projectRecords.filter((record) => (!projectFilter || Number(record.proyectoId) === Number(projectFilter)) && (!dateFilter || record.fecha === dateFilter));
  const groups = dailyGroups(records);
  const rows = groups.map((group) => {
    const project = currentData.projects.find((item) => Number(item.id) === group.proyectoId);
    const daily = calcularCumplimientoDiario(group.metaDiaria, group.procesadas);
    const cumulativeProcessed = currentData.projectRecords
      .filter((record) => Number(record.proyectoId) === group.proyectoId && record.fecha <= group.fecha)
      .reduce((sum, record) => sum + Number(record.procesadas || 0), 0);
    const global = calcularCumplimientoGlobal(group.metaGlobal, cumulativeProcessed);
    const remaining = project ? getRemaining(project, group.fecha) : 0;
    return makeTableRow([
      formatDate(group.fecha), group.nombreProyecto, formatNumber(group.metaDiaria), formatNumber(group.recibidas),
      formatNumber(group.procesadas), group.metaDiaria > 0 ? `${formatNumber(daily.porcentaje, 1)}%` : "Sin meta",
      formatNumber(daily.faltantes), `${formatNumber(cumulativeProcessed)} / ${formatNumber(group.metaGlobal)} (${formatNumber(global.porcentaje, 1)}%)`,
      formatNumber(global.faltantes), formatNumber(remaining),
    ], ["", "", "", "", "", daily.cumplida ? "compliance-good" : "compliance-low"]);
  });
  renderTableRows("#project-history-body", rows, 10, "No hay registros para esos filtros.");
  const movements = records.slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || String(b.createdAt).localeCompare(String(a.createdAt)));
  const movementRows = movements.map((record) => {
    const project = currentData.projects.find((item) => Number(item.id) === Number(record.proyectoId));
    const projectName = record.nombreProyectoSnapshot || project?.nombre || `Proyecto ${record.proyectoId}`;
    const when = record.createdAt ? new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(record.createdAt)) : formatDate(record.fecha);
    const dailyGoal = Number(record.metaDiariaSnapshot ?? record.metaDiaria ?? project?.metaDiaria ?? 0);
    const globalGoal = Number(record.metaGlobalSnapshot ?? project?.metaGlobal ?? 0);
    return makeTableRow([formatDate(record.fecha) + " · " + when, projectName, formatNumber(dailyGoal), formatNumber(globalGoal), formatNumber(record.recibidas), formatNumber(record.procesadas)]);
  });
  renderTableRows("#movement-history-body", movementRows, 6, "Todavía no hay movimientos registrados.");
}
// Refresca todas las pantallas después de cargar o guardar datos.
function renderAll() {
  fillProjectSelectors();
  renderDashboard();
  renderProjects();
  renderDailySummary();
  renderHistory();
  renderCharts();
}
// Vuelve a leer el repositorio y actualiza la interfaz completa.
async function reloadData() {
  currentData = await repository.getAll();
  renderAll();
}
// Convierte los controles de un formulario en un objeto de valores.
function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}
// Protege comillas dobles para mantener las columnas del archivo CSV correctamente separadas.
function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
// Genera y descarga la evidencia filtrada en formato CSV compatible con Excel.
function downloadCSV(filename, headers, rows) {
  const csv = "\uFEFF" + [headers.map(csvEscape).join(","), ...rows.map((row) => headers.map((key) => csvEscape(row[key])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${todayLocal()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Archivo CSV exportado con detalle por movimiento.");
}
// Muestra las metas del proyecto seleccionado y prepara los campos para registrar un movimiento nuevo.
function loadProjectRecordForm() {
  const form = $("#project-record-form");
  const project = currentData.projects.find((item) => Number(item.id) === Number(form.elements.proyectoId.value));
  if (!project) return;
  $("#record-daily-goal").textContent = formatNumber(project.metaDiaria);
  $("#record-global-goal").textContent = formatNumber(project.metaGlobal);
  form.elements.recibidas.value = 0;
  form.elements.procesadas.value = 0;
  updateRecordPreview();
}
// Calcula una vista previa mientras se escriben cantidades, sin guardar todavía el movimiento.
function updateRecordPreview() {
  const form = $("#project-record-form");
  const project = currentData.projects.find((item) => Number(item.id) === Number(form.elements.proyectoId.value));
  const preview = $("#record-preview");
  if (!project) return;
  const date = form.elements.fecha.value;
  const proposedReceived = Number(form.elements.recibidas.value || 0);
  const proposedProcessed = Number(form.elements.procesadas.value || 0);
  const daily = summarizeDay(project, date);
  const dailyProcessed = daily.processed + proposedProcessed;
  const dailyResult = calcularCumplimientoDiario(daily.goal, dailyProcessed);
  const currentProcessed = getProjectTotal(project.id, "procesadas");
  const globalProcessed = currentProcessed + proposedProcessed;
  const globalResult = calcularCumplimientoGlobal(Number(project.metaGlobal || 0), globalProcessed);
  const beforeDate = currentData.projectRecords.filter((record) => Number(record.proyectoId) === Number(project.id) && record.fecha < date);
  const beforeDayRemaining = Number(project.cajasIniciales || 0)
    + beforeDate.reduce((sum, record) => sum + Number(record.recibidas || 0) - Number(record.procesadas || 0), 0);
  const remaining = beforeDayRemaining + daily.received + proposedReceived - daily.processed - proposedProcessed;
  const dailyText = daily.goal > 0
    ? `Procesado hoy: ${formatNumber(dailyProcessed)} / ${formatNumber(daily.goal)}. ${dailyResult.cumplida ? "Meta diaria cumplida." : `Faltan ${formatNumber(dailyResult.faltantes)} para la meta diaria.`}`
    : "Configura la meta diaria fija de este proyecto.";
  preview.textContent = `${project.nombre} · ${date}: ${dailyText} Avance global: ${formatNumber(globalProcessed)} / ${formatNumber(project.metaGlobal)}; faltan ${formatNumber(globalResult.faltantes)}. Restantes estimadas: ${formatNumber(remaining)}. Cada guardado se agrega como movimiento separado.`;
  preview.className = `form-hint ${daily.goal > 0 && dailyResult.cumplida ? "success" : remaining < 0 ? "warning" : ""}`;
  renderDailySummary();
}
// Conecta botones, filtros y formularios con las acciones que guardan o muestran datos.
// Para cambiar qué ocurre al pulsar o enviar algo, busca aquí el listener correspondiente.
function wireEvents() {
  $$(".nav-link").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $$('[data-go]').forEach((button) => button.addEventListener("click", () => setView(button.dataset.go)));
  const recordForm = $("#project-record-form");
  recordForm.addEventListener("input", updateRecordPreview);
  recordForm.elements.proyectoId.addEventListener("change", loadProjectRecordForm);
  recordForm.elements.fecha.addEventListener("change", loadProjectRecordForm);
  recordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = formValues(recordForm);
    const project = currentData.projects.find((item) => Number(item.id) === Number(values.proyectoId));
    const received = Number(values.recibidas);
    const processed = Number(values.procesadas);
    if (received === 0 && processed === 0) {
      showToast("Ingresa una cantidad recibida o procesada para guardar el movimiento.");
      return;
    }
    // Guardamos una copia de nombre y metas: así el historial conserva la evidencia original
    // aunque luego cambies la configuración actual del proyecto.
    await repository.saveProjectRecord({
      id: crypto.randomUUID(),
      proyectoId: Number(values.proyectoId),
      fecha: values.fecha,
      nombreProyectoSnapshot: project.nombre,
      metaDiariaSnapshot: Number(project.metaDiaria || 0),
      metaGlobalSnapshot: Number(project.metaGlobal || 0),
      recibidas: received,
      procesadas: processed,
      createdAt: new Date().toISOString(),
    });
    recordForm.elements.recibidas.value = 0;
    recordForm.elements.procesadas.value = 0;
    await reloadData();
    updateRecordPreview();
    showToast("Movimiento agregado; los anteriores del día se conservaron.");
  });
  $("#all-projects").addEventListener("submit", async (event) => {
    const form = event.target.closest(".project-config-form");
    if (!form) return;
    event.preventDefault();
    const values = formValues(form);
    const id = Number(form.dataset.projectId);
    const project = currentData.projects.find((item) => Number(item.id) === id);
    // Solo se actualiza la configuración del proyecto enviado; el resto queda independiente.
    await repository.saveProject({ ...project, nombre: values.nombre.trim(), cajasIniciales: Number(values.cajasIniciales), metaDiaria: Number(values.metaDiaria), metaGlobal: Number(values.metaGlobal), fechaLimite: values.fechaLimite });
    await reloadData();
    loadProjectRecordForm();
    showToast("Nombre y metas del proyecto guardados.");
  });
  $("#history-project").addEventListener("change", renderHistory);
  $("#history-date").addEventListener("change", renderHistory);
  $("#chart-project").addEventListener("change", renderCharts);
  $("#chart-from").addEventListener("change", renderCharts);
  $("#chart-to").addEventListener("change", renderCharts);
  $("#export-projects").addEventListener("click", () => {
    // El CSV usa el filtro del historial y agrega contexto diario a cada movimiento exportado.
    const projectFilter = $("#history-project").value;
    const dateFilter = $("#history-date").value;
    const filteredRecords = currentData.projectRecords.filter((record) => (!projectFilter || Number(record.proyectoId) === Number(projectFilter)) && (!dateFilter || record.fecha === dateFilter));
    const groups = new Map(dailyGroups(filteredRecords).map((group) => [`${group.proyectoId}|${group.fecha}`, group]));
    const rows = filteredRecords.map((record) => {
      const group = groups.get(`${record.proyectoId}|${record.fecha}`);
      const project = currentData.projects.find((item) => Number(item.id) === Number(record.proyectoId));
      const dailyResult = calcularCumplimientoDiario(group.metaDiaria, group.procesadas);
      const globalProcessed = currentData.projectRecords
        .filter((item) => Number(item.proyectoId) === Number(record.proyectoId) && item.fecha <= record.fecha)
        .reduce((sum, item) => sum + Number(item.procesadas || 0), 0);
      const globalResult = calcularCumplimientoGlobal(group.metaGlobal, globalProcessed);
      return {
        ...record,
        proyecto: record.nombreProyectoSnapshot || project?.nombre || "",
        procesadasDia: group.procesadas,
        cumplimientoDiario: dailyResult.porcentaje,
        faltantesMetaDiaria: dailyResult.faltantes,
        procesadasAcumuladasGlobal: globalProcessed,
        faltantesMetaGlobal: globalResult.faltantes,
      };
    });
    // Cambia esta lista para incluir o quitar columnas del archivo entregado a tu jefe.
    downloadCSV("evidencia_proyectos", ["fecha", "createdAt", "proyectoId", "proyecto", "metaDiariaSnapshot", "metaGlobalSnapshot", "recibidas", "procesadas", "procesadasDia", "cumplimientoDiario", "faltantesMetaDiaria", "procesadasAcumuladasGlobal", "faltantesMetaGlobal"], rows);
  });
}

// Arranque: fija la fecha inicial, conecta eventos, carga datos y prepara el formulario.
async function init() {
  $("#today-label").textContent = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date());
  const form = $("#project-record-form");
  form.elements.fecha.value = todayLocal();
  wireEvents();
  await reloadData();
  loadProjectRecordForm();
}
init().catch((error) => {
  console.error(error);
  showToast("No se pudo iniciar la aplicación. Revisa la consola.");
});
