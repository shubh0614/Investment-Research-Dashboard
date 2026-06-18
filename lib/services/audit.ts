/**
 * Best-effort audit event writer.
 *
 * Audit writes are fire-and-forget: a failure here never fails the request
 * that triggered it. Errors are logged but swallowed.
 *
 * Actions follow the pattern "<entity>.<verb>", e.g. "report.created".
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditAction =
  | "report.created"
  | "report.updated"
  | "report.deleted"
  | "watchlist.added"
  | "watchlist.removed"
  | "org.invite_viewed";

export async function writeAuditEvent(
  supabase:   SupabaseClient,
  orgId:      string,
  actorId:    string,
  action:     AuditAction,
  entityType?: string,
  entityId?:   string,
  metadata?:   Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await supabase.from("audit_events").insert({
      org_id:        orgId,
      actor_id:      actorId,
      action,
      entity_type:   entityType ?? null,
      entity_id:     entityId   ?? null,
      metadata_json: metadata   ?? null,
    });
    if (error) {
      console.error(`[audit] Failed to write event action=${action} error=${error.message}`);
    }
  } catch (err) {
    console.error(`[audit] Unexpected error action=${action}`, err);
  }
}
