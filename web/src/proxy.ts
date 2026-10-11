import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/api/health", "/api/crm/inbound", "/login", "/auth", "/s/", "/join/", "/p/", "/d/", "/api/rates", "/api/geo", "/geo/", "/maplibre-gl-worker.mjs"]; // курсы валют — публичные данные ЕЦБ; география (справочник, полигоны OSM) — публичная

// Refreshes the Supabase session cookie and guards app routes.
// When Supabase env is missing (local UI work), everything is allowed through.
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });
  // Local UI work without an account: DEV_AUTH_BYPASS=1 in .env.local (development only).
  if (process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "1") return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // "/" — лендинг (главная), открыт всем
  const isPublic = pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));

  if (!user && !isPublic) {
    const next = request.nextUrl.clone();
    next.pathname = "/login";
    next.searchParams.set("next", pathname);
    return NextResponse.redirect(next);
  }
  if (user && pathname === "/login") {
    // Уже вошедший пользователь на /login: застройщика ведём сразу в его кабинет, иначе на долю секунды
    // показывался каталог риэлторов, а потом AppChrome перекидывал в /dev.
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const next = request.nextUrl.clone();
    next.pathname = prof?.role === "developer" ? "/dev" : "/catalog";
    next.search = "";
    return NextResponse.redirect(next);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
