// RFC 9116: Wo Sicherheitslücken gemeldet werden können
export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const expires = new Date(Date.now() + 180 * 86_400_000).toISOString();
  const contact = process.env.SECURITY_CONTACT || `${origin}/impressum`;
  const body = [
    `Contact: ${contact.includes("@") && !contact.startsWith("mailto:") ? `mailto:${contact}` : contact}`,
    `Expires: ${expires}`,
    "Preferred-Languages: de, en",
    `Canonical: ${origin}/.well-known/security.txt`,
    `Policy: ${origin}/datenschutz`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
