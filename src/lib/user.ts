import type { User } from '@supabase/supabase-js';

/** Best-effort first name: Google/OAuth metadata first, then the email local part. */
export function getFirstName(user: User | null | undefined): string {
  if (!user) return '';
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const raw =
    (meta.given_name as string | undefined) ||
    (meta.first_name as string | undefined) ||
    (meta.full_name as string | undefined) ||
    (meta.name as string | undefined) ||
    (meta.preferred_username as string | undefined) ||
    user.email?.split('@')[0] ||
    '';
  // "Yeleul Engeda" -> "Yeleul"; "yeleul.engeda" -> "yeleul"
  const first = raw.trim().split(/[\s._-]+/)[0] ?? '';
  return first ? first[0].toUpperCase() + first.slice(1) : '';
}

/** Single uppercase letter for the avatar, e.g. "Y" for Yeleul. */
export function getInitial(user: User | null | undefined): string {
  const name = getFirstName(user);
  const ch = Array.from(name)[0];
  return ch ? ch.toUpperCase() : '?';
}
