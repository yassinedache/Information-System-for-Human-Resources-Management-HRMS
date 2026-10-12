/* Chart.js with the theme's colours (only the pieces the dashboard uses, to keep the bundle small). */
import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { useAuth } from "./auth.jsx";

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip);

export const PALETTE = ["#4169e1", "#06b6d4", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#ec4899", "#64748b"];

// same values as the CSS variables of styles.css (read here because the theme attribute changes after render)
const THEMES = {
  light: { text: "#6b7280", grid: "#e5e7eb", primary: "#4169e1", surface: "#ffffff" },
  dark: { text: "#98a2b8", grid: "#2b3448", primary: "#6b8cff", surface: "#171e2d" },
};

function useColors() {
  const { theme } = useAuth();
  return { theme, ...(THEMES[theme] || THEMES.light) };
}

function base(c) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: c.text, boxWidth: 12, usePointStyle: true } }, tooltip: { padding: 10 } },
  };
}

export function BarChart({ labels, data, label, horizontal }) {
  const c = useColors();
  const opts = base(c);
  return (
    <Bar key={c.theme} data={{ labels, datasets: [{ label, data, backgroundColor: c.primary, borderRadius: 6, maxBarThickness: 28 }] }}
      options={{ ...opts, indexAxis: horizontal ? "y" : "x", plugins: { ...opts.plugins, legend: { display: false } },
        scales: { x: { ticks: { color: c.text, precision: 0 }, grid: { color: horizontal ? c.grid : "transparent" } },
          y: { ticks: { color: c.text, precision: 0 }, grid: { color: horizontal ? "transparent" : c.grid } } } }} />
  );
}

export function LineChart({ labels, data, label }) {
  const c = useColors();
  const opts = base(c);
  return (
    <Line key={c.theme} data={{ labels, datasets: [{ label, data, borderColor: c.primary, backgroundColor: c.primary + "22", fill: true, tension: 0.3, cubicInterpolationMode: "monotone", pointRadius: 3 }] }}
      options={{ ...opts, plugins: { ...opts.plugins, legend: { display: false } },
        scales: { x: { ticks: { color: c.text }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: c.text, precision: 0 }, grid: { color: c.grid } } } }} />
  );
}

export function DoughnutChart({ labels, data }) {
  const c = useColors();
  const opts = base(c);
  return (
    <Doughnut key={c.theme} data={{ labels, datasets: [{ data, backgroundColor: PALETTE, borderColor: c.surface, borderWidth: 2 }] }}
      options={{ ...opts, cutout: "62%", plugins: { ...opts.plugins, legend: { position: "right", labels: { color: c.text, boxWidth: 12, usePointStyle: true } } } }} />
  );
}
