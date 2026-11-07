import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Ohne Login erreichbar: Landing Page, Login/Registrierung, Login-Links, Partner-Weiterleitung, Rechtliches
const PUBLIC_PATHS = [
  "/login",
  "/registrieren",
  "/j",
  "/go",
  "/impressum",
  "/datenschutz",
  "/nutzungsbedingungen",
  "/.well-known",
];

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy mit Nonce pro Anfrage: Nur Skripte mit diesem Nonce (bzw. von ihnen
 * nachgeladene) dürfen laufen – eingeschleuster Code wird vom Browser blockiert.
 */
function buildCsp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // Inline-Styles (Fortschrittsbalken, Toasts) – keine Skripte
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/** Erneuert die Login-Session bei jedem Request, setzt Sicherheits-Header und schickt Gäste zum Login. */
export async function updateSession(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // Next.js liest den Nonce aus dem Request-Header und versieht damit seine eigenen Skripte
  const next = () => {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    return NextResponse.next({ request: { headers: requestHeaders } });
  };

  let response = next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: { httpOnly: true, secure: !isDev, sameSite: "lax", path: "/" },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = next();
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Wichtig: direkt nach createServerClient aufrufen (erneuert abgelaufene Tokens).
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  const isPublic = pathname === "/" || PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isApi = pathname.startsWith("/api/");

  if (!isLoggedIn && !isPublic && !isApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}
