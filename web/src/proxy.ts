import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/api/health", "/api/crm/inbound", "/api/v1/", "/api/docs", "/feed/", "/share/", "/login", "/auth", "/s/", "/join/", "/p/", "/d/", "/api/rates", "/api/geo", "/geo/", "/maplibre-gl-worker.mjs", "/map-style.json"]; // курсы валют — публичные данные ЕЦБ; география (справочник, полигоны OSM) — публичная

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
  // Незавершённый вход по ссылке восстановления/приглашения (cookie opl-pw-pending, ставит /auth/callback): пока пароль не
  // сохранён — только форма пароля; без сессии флаг снимается (13.10.2026).
  const pending = request.cookies.get("opl-pw-pending")?.value === "1";
  if (pending && !user) response.cookies.set("opl-pw-pending", "", { path: "/", maxAge: 0 });
  if (pending && user && !pathname.startsWith("/auth") && !pathname.startsWith("/api/")) {
    const next = request.nextUrl.clone(); next.pathname = "/auth/callback"; next.search = "?resume=1";
    return NextResponse.redirect(next);
  }
  // "/" — лендинг (главная), открыт всем
  const isPublic = pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));

  // Превью ссылки на объект в мессенджерах (16.10.2026): бот без сессии получает публичную обложку /share/obj/<id>
  // (заголовок, цена, фото, риэлтор), человек — вход как раньше.
  if (!user && /^\/obj\/[0-9a-f-]{36}$/i.test(pathname) && /Telegram|WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|vkShare|Viber|Skype|iMessage|Applebot|Googlebot|bingbot|TelegramBot/i.test(request.headers.get("user-agent") ?? "")) {
    const url = request.nextUrl.clone(); url.pathname = `/share${pathname}`; url.search = "";
    return NextResponse.rewrite(url);
  }
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
