import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refresca la sesión de Supabase y protege /admin. La verificación de que el usuario
// es admin se repite en cada página y acción del panel (y la base la exige por RLS).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (aSetear, headers) => {
          aSetear.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          aSetear.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const logueado = Boolean(data?.claims?.sub);
  const ruta = request.nextUrl.pathname;

  if (!logueado && ruta !== "/admin/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
