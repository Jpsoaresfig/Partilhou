"use client";

import Link from "next/link";
import { useState } from "react";
import Icon from "./icons";

/**
 * Atalhos flutuantes (canto inferior esquerdo). Clicar abre um painel com as
 * acoes principais. Fica no lado oposto ao chat (direita) para nao colidir.
 */
export default function TrustFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="trust-fab-wrap">
      {open && (
        <>
          <button
            type="button"
            className="trust-fab-backdrop"
            aria-label="Fechar"
            onClick={() => setOpen(false)}
          />
          <div className="trust-fab-panel" role="dialog" aria-label="Atalhos da Partilhou">
            <div className="trust-fab-actions">
              <Link
                href="/vender"
                className="btn btn-primary"
                onClick={() => setOpen(false)}
              >
                <Icon name="dollar" size={17} />
                Anunciar produto
              </Link>
              <Link
                href="/registrar"
                className="btn btn-ghost"
                onClick={() => setOpen(false)}
              >
                <Icon name="users" size={17} />
                Começar a afiliar
              </Link>
            </div>
          </div>
        </>
      )}
      <button
        type="button"
        className="trust-fab"
        aria-expanded={open}
        aria-label="Atalhos da Partilhou"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={open ? "close" : "plus"} size={24} />
      </button>
    </div>
  );
}
