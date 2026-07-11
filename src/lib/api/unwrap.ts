/** L'API enveloppe ses réponses dans { ok, data } : désenveloppe le JSON. */
export function unwrap<T>(json: unknown): T {
  const j = json as { data?: T } | null;
  return (j?.data ?? json) as T;
}
