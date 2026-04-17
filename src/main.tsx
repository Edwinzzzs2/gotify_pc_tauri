import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyThemeMode, getStoredThemeMode } from "./lib/theme";
import "./styles.css";

// 在任何渲染前立刻应用已存储的主题，确保原生标题栏跟随变色
applyThemeMode(getStoredThemeMode());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
