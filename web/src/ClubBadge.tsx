import { clubById } from "./clubs.ts";

export function ClubBadge({ id, size = "md" }: { id: string; size?: "sm" | "md" | "lg" }) {
  const c = clubById[id];
  if (!c) return null;
  const [a, b] = c.colors;
  return (
    <div className={`badge badge-${size}`}>
      <span className="crest" style={{ background: `linear-gradient(135deg, ${a} 50%, ${b} 50%)` }} />
      <span className="club-name">{c.name}</span>
    </div>
  );
}
