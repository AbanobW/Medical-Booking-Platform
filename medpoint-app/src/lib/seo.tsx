/**
 * Structured-data helper.
 *
 * This module used to resolve a provider on the server so each profile route
 * could emit a real 404, a per-provider `<title>`, and Schema.org JSON-LD. All
 * of it read the seeded dataset, which was in the bundle and therefore
 * available synchronously during a server render.
 *
 * The catalogue now lives behind `/v1/providers`, which requires a bearer
 * token. A server render has no signed-in user and a crawler never will, so
 * there is nothing to look the slug up against: per-provider metadata, JSON-LD
 * and the server-side 404 are gone with it, and profile routes render their
 * client component with the generic site title.
 *
 * Restoring them needs a public provider endpoint (or a build-time service
 * credential) — tracked in BACKEND-GAPS.md.
 */

/** Emits a JSON-LD block. Kept for the static structured data the site still has. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // The payload is our own object, not user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
