export const DEFAULT_MEMBER_ID_FORMATS = {
  student: "ST-{DD}{MM}{YY}{SEQ:3}",
  teacher: "IN-{DD}{MM}{YY}{SEQ:3}",
};

export function formatMemberId(template, date, sequence) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear()).slice(-2);

  return template.replace(/\{(DD|MM|YY|SEQ(?::([1-6]))?)\}/g, (token, part, width) => {
    if (part === "DD") return day;
    if (part === "MM") return month;
    if (part === "YY") return year;
    return String(sequence).padStart(Number(width || 3), "0");
  });
}
