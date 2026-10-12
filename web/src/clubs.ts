import clubsJson from "@duello/shared/data/clubs.json";
import type { Club, Mode } from "@duello/shared";

export const clubs = clubsJson as Club[];
export const clubById = Object.fromEntries(clubs.map((c) => [c.id, c])) as Record<string, Club>;
export const clubsFor = (m: Mode) => clubs.filter((c) => c.modes.includes(m));
export const MODE_LABEL: Record<Mode, string> = { tr: "Süper Lig", eu: "Avrupa" };
