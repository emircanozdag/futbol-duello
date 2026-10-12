// data-pipeline/normalize.py ile birebir aynı mantık olmalı.
const TR: Record<string, string> = {
  ı: "i", İ: "i", ş: "s", Ş: "s", ğ: "g", Ğ: "g", ç: "c", Ç: "c", ö: "o", Ö: "o", ü: "u", Ü: "u",
  ß: "ss", ø: "o", Ø: "o", đ: "d", Đ: "d", ł: "l", Ł: "l", æ: "ae",
};

export function normalize(s: string): string {
  return s
    .replace(/[ıİşŞğĞçÇöÖüÜßøØđĐłŁæ]/g, (ch) => TR[ch])
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
