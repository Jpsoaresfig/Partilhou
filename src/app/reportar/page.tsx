import ReportForm from "@/components/ReportForm";

export const metadata = { title: "Reportar problema — Partilhou" };

export default function ReportarPage() {
  return (
    <main className="container mt-3 mb-3" style={{ maxWidth: 560 }}>
      <h1>Reportar problema</h1>
      <p className="muted small" style={{ marginTop: -4 }}>
        Encontrou um erro, cobrança estranha ou um anúncio suspeito? Conte pra
        gente. Nossa equipe analisa cada relato.
      </p>
      <ReportForm />
    </main>
  );
}
