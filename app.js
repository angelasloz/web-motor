// AIO_USERNAME, FEED_1, FEED_2 y FEED_3 vienen de config.js
const POLL_INTERVAL_MS = 5000; // cada 5 segundos
const MAX_POINTS = 30;         // puntos visibles en cada gráfico

const statusEl = document.getElementById("status");
const value1El = document.getElementById("value1");
const value2El = document.getElementById("value2");
const gaugeValueEl = document.getElementById("gaugeValue");
document.getElementById("gaugeMin").textContent = POTENCIA_MIN;
document.getElementById("gaugeMax").textContent = POTENCIA_MAX;

// Guarda el id del último dato recibido por feed para evitar duplicados
const lastId = { [FEED_1]: null, [FEED_2]: null, [FEED_3]: null };

// --- Configuración común de Chart.js ---
const baseOptions = (color) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400 },
  plugins: {
    legend: { display: false },
    tooltip: { mode: "index", intersect: false },
  },
  scales: {
    x: {
      title: { display: true, text: "Tiempo" },
      ticks: { maxTicksLimit: 8, color: "#7a8794" },
      grid: { color: "rgba(0,0,0,0.05)" },
    },
    y: {
      title: { display: true, text: "Valor" },
      ticks: { color: "#7a8794" },
      grid: { color: "rgba(0,0,0,0.05)" },
    },
  },
});

const datasetConfig = (label, color) => ({
  label,
  data: [],
  borderColor: color,
  backgroundColor: color + "22",
  borderWidth: 2,
  fill: true,
  tension: 0.3,
  pointRadius: 3,
  pointHoverRadius: 5,
});

const chart1 = new Chart(document.getElementById("chart1"), {
  type: "line",
  data: { labels: [], datasets: [datasetConfig("Presión 1", "#002855")] },
  options: baseOptions(),
});

const chart2 = new Chart(document.getElementById("chart2"), {
  type: "line",
  data: { labels: [], datasets: [datasetConfig("Presión 2", "#1a73e8")] },
  options: baseOptions(),
});

// --- Gauge de potencia (half doughnut) ---
const gaugeChart = new Chart(document.getElementById("gaugeChart"), {
  type: "doughnut",
  data: {
    datasets: [
      {
        data: [0, POTENCIA_MAX - POTENCIA_MIN],
        backgroundColor: ["#002855", "#e2e6ec"],
        borderWidth: 0,
        circumference: 180,
        rotation: 270,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
  },
});

function updateGauge(value) {
  const v = Math.max(POTENCIA_MIN, Math.min(POTENCIA_MAX, value));
  const filled = v - POTENCIA_MIN;
  const empty = POTENCIA_MAX - v;
  gaugeChart.data.datasets[0].data = [filled, empty];
  gaugeChart.update();
  gaugeValueEl.textContent = isNaN(value) ? "--" : value.toFixed(1);
}

// --- Lógica de red ---
async function fetchFeed(feedKey) {
  const url = `https://io.adafruit.com/api/v2/${AIO_USERNAME}/feeds/${feedKey}/data?limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error ${res.status} en feed ${feedKey}`);
  const data = await res.json();
  return data[0] || null;
}

function pushPoint(chart, label, value) {
  chart.data.labels.push(label);
  chart.data.datasets[0].data.push(value);
  if (chart.data.labels.length > MAX_POINTS) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update();
}

function formatTime(isoString) {
  const d = isoString ? new Date(isoString) : new Date();
  return d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

async function update() {
  try {
    const [d1, d2, d3] = await Promise.all([
      fetchFeed(FEED_1),
      fetchFeed(FEED_2),
      fetchFeed(FEED_3),
    ]);

    if (d1 && d1.id !== lastId[FEED_1]) {
      lastId[FEED_1] = d1.id;
      const v = parseFloat(d1.value);
      value1El.textContent = isNaN(v) ? d1.value : v.toFixed(2);
      pushPoint(chart1, formatTime(d1.created_at), v);
    }

    if (d2 && d2.id !== lastId[FEED_2]) {
      lastId[FEED_2] = d2.id;
      const v = parseFloat(d2.value);
      value2El.textContent = isNaN(v) ? d2.value : v.toFixed(2);
      pushPoint(chart2, formatTime(d2.created_at), v);
    }

    if (d3 && d3.id !== lastId[FEED_3]) {
      lastId[FEED_3] = d3.id;
      const v = parseFloat(d3.value);
      updateGauge(v);
    }

    statusEl.textContent = `Conectado · última actualización: ${formatTime()}`;
    statusEl.style.color = "#2e7d32";
  } catch (err) {
    console.error(err);
    statusEl.textContent = `Error de conexión: ${err.message}`;
    statusEl.style.color = "#c62828";
  }
}

update();
setInterval(update, POLL_INTERVAL_MS);