"use client";

import { useState } from "react";
import { Users, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { toast } from "@/lib/toast";

interface Member {
  id:         string;
  full_name:  string | null;
  email:      string;
  role:       string;
  created_at: string;
}

interface Props {
  initialMembers: Member[];
  currentUserId:  string;
}

export function MembersTableClient({ initialMembers, currentUserId }: Props) {
  const [members,   setMembers]   = useState<Member[]>(initialMembers);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [removing,  setRemoving]  = useState<string | null>(null);

  async function handleRemove(id: string) {
    setRemoving(id);
    try {
      await apiFetch(`/api/org/members/${id}`, { method: "DELETE" });
      setMembers((prev) => prev.filter((m) => m.id !== id));
      toast("Member removed", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to remove member", "error");
    } finally {
      setRemoving(null);
      setConfirmId(null);
    }
  }

  if (members.length === 0) {
    return (
      <div
        className="flex h-32 items-center justify-center rounded-xl border"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="text-center">
          <Users size={22} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No members yet</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div
        className="grid items-center px-5 py-2"
        style={{ gridTemplateColumns: "1fr 90px 110px 40px", borderBottom: "1px solid var(--border)" }}
      >
        {["Member", "Role", "Joined", ""].map((h) => (
          <span key={h} className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{h}</span>
        ))}
      </div>

      {members.map((m, i) => {
        const isSelf    = m.id === currentUserId;
        const isConfirm = confirmId === m.id;
        const isRemoving = removing === m.id;

        if (isConfirm) {
          return (
            <div
              key={m.id}
              className="flex items-center justify-between px-5 py-3"
              style={{
                borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                background: "color-mix(in srgb, var(--negative) 5%, transparent)",
              }}
            >
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Remove <span style={{ color: "var(--text)", fontWeight: 500 }}>{m.full_name || m.email}</span>?
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleRemove(m.id)}
                  disabled={isRemoving}
                  className="text-xs font-medium"
                  style={{ color: "var(--negative)", background: "none", border: "none", cursor: "pointer", opacity: isRemoving ? 0.5 : 1 }}
                >
                  {isRemoving ? "Removing…" : "Remove"}
                </button>
                <span style={{ color: "var(--border)" }}>·</span>
                <button
                  onClick={() => setConfirmId(null)}
                  className="text-xs"
                  style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        }

        return (
          <div
            key={m.id}
            className="row-hover grid items-center px-5 py-3"
            style={{
              gridTemplateColumns: "1fr 90px 110px 40px",
              borderTop: i > 0 ? "1px solid var(--border)" : undefined,
            }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                {m.full_name || m.email}
                {isSelf && (
                  <span className="ml-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>(you)</span>
                )}
              </p>
              {m.full_name && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{m.email}</p>
              )}
            </div>

            <span
              className="inline-flex w-fit items-center rounded px-2 py-0.5 text-xs font-medium"
              style={{
                color:      m.role === "admin" ? "var(--accent)" : "var(--text-muted)",
                background: m.role === "admin"
                  ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                  : "var(--surface-2)",
              }}
            >
              {m.role}
            </span>

            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>

            {/* Remove button — hidden for self */}
            <div className="flex justify-end">
              {!isSelf && (
                <button
                  onClick={() => setConfirmId(m.id)}
                  aria-label={`Remove ${m.full_name || m.email}`}
                  className="btn-icon btn-icon-danger flex h-7 w-7 items-center justify-center rounded-lg"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
