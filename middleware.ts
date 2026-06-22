import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Roda apenas nas navegacoes de PAGINA (Server Components), onde a sessao
  // precisa ser renovada nos cookies. Excluimos:
  //   * assets estaticos do Next e arquivos com extensao (imagens, fontes, css);
  //   * TODAS as rotas /api/* — cada handler ja se autentica via requireUser()
  //     (getUser valida o token e regrava os cookies na propria resposta). Rodar
  //     o middleware aqui dobrava o round-trip de auth por chamada de API.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff2?|ttf|map)$).*)",
  ],
};
