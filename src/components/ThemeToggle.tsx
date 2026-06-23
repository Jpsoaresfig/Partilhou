"use client";

import { useEffect, useState } from "react";
import Icon from "./icons";

type Theme = "dark" | "light";

/**
 * Alterna entre tema escuro (padrao, estilo Facebook) e claro.
 * O tema fica salvo no localStorage e e aplicado antes do paint pelo
 * script inline em layout.tsx (evita o "flash" de tema errado).
 */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as Theme) || "dark";
    setTheme(current);
    // Liga a transicao suave so depois do primeiro render.
    document.documentElement.classList.add("theme-ready");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignora storage indisponivel */
    }
  }

  const label = theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro";

  if (compact) {
    return (
      <button className="nav-item" onClick={toggle} aria-label={label} title={label}>
        <span className="nav-ico">
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </span>
        <span className="nav-label">Tema</span>
      </button>
    );
  }

  return (
    <button className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
      <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
    </button>
  );
}
