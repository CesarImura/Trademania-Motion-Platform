// Export file names follow the scene name ("Light -> Blue -> Light v2" →
// "Light → Blue → Light v2.mp4"): readable, but safe on macOS and Windows.

const ILLEGAL_CHARS = "/\\\\:*?\"<>|\\u0000-\\u001f";
const ILLEGAL = new RegExp(`[${ILLEGAL_CHARS}]`, "g"), HAS_ILLEGAL = new RegExp(`[${ILLEGAL_CHARS}]`); // no /g: .test() stays stateless

/** "<scene name>.mp4" — `->` becomes `→`, characters filesystems reject are dropped. */
export function exportFileName(sceneName: string, fallback: string, suffix = "") {
  const base = (sceneName ?? "")
    .replace(/\s*->\s*/g, " → ")
    .replace(/\s*<-\s*/g, " ← ")
    .replace(ILLEGAL, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  return `${base || fallback}${suffix}.mp4`;
}

/** Server-side check for an export file name (no paths, no hidden files, .mp4). */
export function isValidExportName(file: string) {
  return file.length <= 200 && file.endsWith(".mp4") && !file.startsWith(".") && !HAS_ILLEGAL.test(file) && file !== ".mp4";
}
