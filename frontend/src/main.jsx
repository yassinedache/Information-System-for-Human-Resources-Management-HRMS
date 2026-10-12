import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { startDemo } from "./demo/bridge.js";
import "./styles.css";

if (__DEMO__) startDemo().catch(() => { /* the boot screen shows the error */ });

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
