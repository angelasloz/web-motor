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

// Array de sesiones: [{ start, end, feed1: [{t,v}], feed2: [{t,v}] }, ...]
let sessions = [];

async function fetchAllData(feedKey, limit = 1000) {
  const url = `https://io.adafruit.com/api/v2/${AIO_USERNAME}/feeds/${feedKey}/data?limit=${limit}`;
  const res = await fetch(url, { headers: { "X-AIO-Key": AIO_KEY } });
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

function buildChart(canvasId, label, points, color) {
  const sorted = [...points].sort((a, b) => a.t - b.t);
  return new Chart(document.getElementById(canvasId), {
    type: "line",
    data: {
      labels: sorted.map((p) =>
        p.t.toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      ),
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
      plugins: { legend: { display: false } },
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

  if (histChart1) histChart1.destroy();
  if (histChart2) histChart2.destroy();
  if (histChart3) histChart3.destroy();

  histChart1 = buildChart("histChart1", "Presión 1", session.feed1, "#002855");
  histChart2 = buildChart("histChart2", "Presión 2", session.feed2, "#1a73e8");
  histChart3 = buildChart("histChart3", "Potencia", session.feed3, "#e67e22");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

backBtn.addEventListener("click", () => {
  detailView.classList.add("hidden");
  gridView.classList.remove("hidden");
});

loadHistory();
