// Historial: agrupa los datos en SESIONES.
// Una sesión = bloque de tiempo en el que la placa estuvo enviando datos.
// Si pasan más de SESSION_GAP_MS ms sin datos, se considera que la placa se
// desconectó y la siguiente medición inicia una sesión nueva.

const SESSION_GAP_MS = 2 * 60 * 1000; // 2 minutos

const gridView = document.getElementById("grid-view");
const detailView = document.getElementById("detail-view");
const daysGrid = document.getElementById("days-grid");
const backBtn = document.getElementById("back-btn");
const detailDate = document.getElementById("detail-date");

let histChart1 = null;
let histChart2 = null;
let histChart3 = null;
let histChartCombo = null;
let modalChart = null;

// Guarda la sesión actualmente mostrada (para el modal)
let currentSession = null;

// Estado del filtro temporal de la gráfica combinada
let comboDurationMs = 5 * 60 * 1000; // 5 min por defecto (0 = todo)
let comboStartOffsetMs = 0;          // desplazamiento desde el inicio de la sesión

// Array de sesiones: [{ start, end, feed1: [{t,v}], feed2: [{t,v}] }, ...]
let sessions = [];

async function fetchAllData(feedKey, limit = 1000) {
  const url = `https://io.adafruit.com/api/v2/${AIO_USERNAME}/feeds/${feedKey}/data?limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error ${res.status} en feed ${feedKey}`);
  return res.json();
}

function formatDate(date) {
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(date) {
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms) {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}min`;
}

async function loadHistory() {
  try {
    const [data1, data2, data3] = await Promise.all([
      fetchAllData(FEED_1),
      fetchAllData(FEED_2),
      fetchAllData(FEED_3),
    ]);

    // Normalizamos: cada punto lleva su feed y se ordena por tiempo
    const all = [
      ...data1.map((p) => ({
        t: new Date(p.created_at),
        v: parseFloat(p.value),
        feed: "feed1",
      })),
      ...data2.map((p) => ({
        t: new Date(p.created_at),
        v: parseFloat(p.value),
        feed: "feed2",
      })),
      ...data3.map((p) => ({
        t: new Date(p.created_at),
        v: parseFloat(p.value),
        feed: "feed3",
      })),
    ].sort((a, b) => a.t - b.t);

    sessions = detectSessions(all);
    renderGrid();
  } catch (err) {
    console.error(err);
    daysGrid.innerHTML = `<p class="error">Error al cargar el historial: ${err.message}</p>`;
  }
}

function detectSessions(points) {
  const result = [];
  let current = null;

  for (const p of points) {
    if (!current || p.t - current.end > SESSION_GAP_MS) {
      // Nueva sesión
      current = {
        start: p.t,
        end: p.t,
        feed1: [],
        feed2: [],
        feed3: [],
      };
      result.push(current);
    } else {
      current.end = p.t;
    }
    current[p.feed].push({ t: p.t, v: p.v });
  }

  return result;
}

function renderGrid() {
  if (sessions.length === 0) {
    daysGrid.innerHTML = `<p class="loading">No hay sesiones registradas todavía.</p>`;
    return;
  }

  // Más recientes primero
  const ordered = [...sessions].reverse();

  daysGrid.innerHTML = "";
  ordered.forEach((session, idx) => {
    const sessionIndex = sessions.indexOf(session);
    const total =
      session.feed1.length + session.feed2.length + session.feed3.length;
    const duration = formatDuration(session.end - session.start);

    const block = document.createElement("div");
    block.className = "day-block";
    block.innerHTML = `
      <div class="day-date">${formatDate(session.start)}</div>
      <div class="day-time">${formatTime(session.start)} – ${formatTime(session.end)}</div>
      <div class="day-info">${total} mediciones · ${duration}</div>
      <div class="day-hint">Ver gráficas &rarr;</div>
    `;
    block.addEventListener("click", () => showDetail(sessionIndex));
    daysGrid.appendChild(block);
  });
}

function timeLabel(t) {
  return t.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function buildChart(canvasId, label, points, color, showLegend = false) {
  const sorted = [...points].sort((a, b) => a.t - b.t);
  return new Chart(document.getElementById(canvasId), {
    type: "line",
    data: {
      labels: sorted.map((p) => timeLabel(p.t)),
      datasets: [
        {
          label,
          data: sorted.map((p) => p.v),
          borderColor: color,
          backgroundColor: color + "22",
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: showLegend } },
      scales: {
        x: { title: { display: true, text: "Hora" } },
        y: { title: { display: true, text: "Valor" } },
      },
    },
  });
}

// Combina dos series en un mismo eje temporal
function buildComboChart(canvasId, points1, points2) {
  // Unimos timestamps de ambos feeds y los ordenamos
  const allTimes = [...points1, ...points2]
    .map((p) => p.t.getTime())
    .sort((a, b) => a - b);
  const uniqueTimes = [...new Set(allTimes)].map((ms) => new Date(ms));

  const mapValue = (points, t) => {
    const found = points.find((p) => p.t.getTime() === t.getTime());
    return found ? found.v : null;
  };

  return new Chart(document.getElementById(canvasId), {
    type: "line",
    data: {
      labels: uniqueTimes.map(timeLabel),
      datasets: [
        {
          label: "Presión 1",
          data: uniqueTimes.map((t) => mapValue(points1, t)),
          borderColor: "#002855",
          backgroundColor: "#00285522",
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 2,
          spanGaps: true,
        },
        {
          label: "Presión 2",
          data: uniqueTimes.map((t) => mapValue(points2, t)),
          borderColor: "#1a73e8",
          backgroundColor: "#1a73e822",
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 2,
          spanGaps: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: "top" } },
      scales: {
        x: { title: { display: true, text: "Hora" } },
        y: { title: { display: true, text: "Valor" } },
      },
    },
  });
}

function showDetail(idx) {
  const session = sessions[idx];
  gridView.classList.add("hidden");
  detailView.classList.remove("hidden");
  detailDate.textContent = `Sesión del ${formatDate(session.start)} · ${formatTime(
    session.start
  )} – ${formatTime(session.end)}`;

  currentSession = session;

  if (histChart1) histChart1.destroy();
  if (histChart2) histChart2.destroy();
  if (histChart3) histChart3.destroy();
  if (histChartCombo) histChartCombo.destroy();

  histChart1 = buildChart("histChart1", "Presión 1", session.feed1, "#002855");
  histChart2 = buildChart("histChart2", "Presión 2", session.feed2, "#1a73e8");
  histChart3 = buildChart("histChart3", "Potencia", session.feed3, "#e67e22");
  // Combo chart: arranca aplicando el filtro temporal
  comboStartOffsetMs = 0;
  refreshComboChart();
  updateSliderUI();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

backBtn.addEventListener("click", () => {
  detailView.classList.add("hidden");
  gridView.classList.remove("hidden");
});

// ---------- FILTRO TEMPORAL DEL GRÁFICO COMBINADO ----------
function getComboWindow() {
  if (!currentSession) return null;
  const sessStart = currentSession.start.getTime();
  const sessEnd = currentSession.end.getTime();
  const totalMs = sessEnd - sessStart;

  if (comboDurationMs === 0 || comboDurationMs >= totalMs) {
    return { from: sessStart, to: sessEnd };
  }
  const maxStart = totalMs - comboDurationMs;
  const offset = Math.min(comboStartOffsetMs, maxStart);
  const from = sessStart + offset;
  return { from, to: from + comboDurationMs };
}

function filterPoints(points, from, to) {
  return points.filter((p) => {
    const t = p.t.getTime();
    return t >= from && t <= to;
  });
}

function refreshComboChart() {
  if (!currentSession) return;
  const w = getComboWindow();
  const p1 = filterPoints(currentSession.feed1, w.from, w.to);
  const p2 = filterPoints(currentSession.feed2, w.from, w.to);

  if (histChartCombo) histChartCombo.destroy();
  histChartCombo = buildComboChart("histChartCombo", p1, p2);
}

function updateSliderUI() {
  const slider = document.getElementById("window-slider");
  const label = document.getElementById("window-label");
  if (!currentSession) return;
  const sessStart = currentSession.start.getTime();
  const sessEnd = currentSession.end.getTime();
  const totalMs = sessEnd - sessStart;

  const isAll = comboDurationMs === 0 || comboDurationMs >= totalMs;
  slider.disabled = isAll;

  const w = getComboWindow();
  const fmt = (ms) =>
    new Date(ms).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  label.textContent = isAll
    ? `Sesión completa (${fmt(sessStart)} – ${fmt(sessEnd)})`
    : `${fmt(w.from)} – ${fmt(w.to)}`;
}

// Botones de duración
document.querySelectorAll("#duration-presets button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll("#duration-presets button")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    comboDurationMs = parseInt(btn.dataset.duration, 10);
    comboStartOffsetMs = 0;
    document.getElementById("window-slider").value = 0;
    refreshComboChart();
    updateSliderUI();
  });
});

// Slider para mover la ventana
document.getElementById("window-slider").addEventListener("input", (e) => {
  if (!currentSession) return;
  const sessStart = currentSession.start.getTime();
  const sessEnd = currentSession.end.getTime();
  const totalMs = sessEnd - sessStart;
  if (comboDurationMs === 0 || comboDurationMs >= totalMs) return;
  const maxStart = totalMs - comboDurationMs;
  comboStartOffsetMs = (parseInt(e.target.value, 10) / 100) * maxStart;
  refreshComboChart();
  updateSliderUI();
});

// ---------- MODAL para ampliar gráficas ----------
const modal = document.getElementById("chart-modal");
const modalClose = document.getElementById("modal-close");
const modalTitle = document.getElementById("modal-title");

function openModal(targetId) {
  if (!currentSession) return;

  const titles = {
    histChart1: "Presión 1",
    histChart2: "Presión 2",
    histChart3: "Potencia",
    histChartCombo: "Comparativa Presión 1 vs Presión 2",
  };
  modalTitle.textContent = titles[targetId] || "Gráfica";

  if (modalChart) modalChart.destroy();

  if (targetId === "histChart1") {
    modalChart = buildChart("modalChart", "Presión 1", currentSession.feed1, "#002855");
  } else if (targetId === "histChart2") {
    modalChart = buildChart("modalChart", "Presión 2", currentSession.feed2, "#1a73e8");
  } else if (targetId === "histChart3") {
    modalChart = buildChart("modalChart", "Potencia", currentSession.feed3, "#e67e22");
  } else if (targetId === "histChartCombo") {
    const w = getComboWindow();
    const p1 = filterPoints(currentSession.feed1, w.from, w.to);
    const p2 = filterPoints(currentSession.feed2, w.from, w.to);
    modalChart = buildComboChart("modalChart", p1, p2);
  }

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modal.classList.add("hidden");
  document.body.style.overflow = "";
  if (modalChart) {
    modalChart.destroy();
    modalChart = null;
  }
}

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("expand-btn")) {
    openModal(e.target.dataset.target);
  }
});

modalClose.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

loadHistory();
