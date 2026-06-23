/**
 * Consulta de CEP via ViaCEP (base pública dos Correios, sem chave/CORS livre).
 * Retorna os campos de endereço já normalizados, ou null se o CEP não existir.
 */
export type CepAddress = {
  street: string;
  district: string;
  city: string;
  state: string;
};

/** Mantém apenas dígitos do CEP. */
export function digitsOnlyCep(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

/** Formata 8 dígitos como 00000-000. */
export function formatCep(value: string): string {
  const d = digitsOnlyCep(value);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export async function lookupCep(rawCep: string): Promise<CepAddress | null> {
  const cep = digitsOnlyCep(rawCep);
  if (cep.length !== 8) return null;

  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!res.ok) throw new Error("Falha na consulta de CEP");

  const data = (await res.json()) as {
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
    erro?: boolean;
  };
  if (data.erro) return null;

  return {
    street: data.logradouro ?? "",
    district: data.bairro ?? "",
    city: data.localidade ?? "",
    state: (data.uf ?? "").toUpperCase(),
  };
}
