export const MAX_RESUME_BYTES = 8 * 1024 * 1024;

/** MIME labels vary between browsers/OSes; validate the bytes, not File.type. */
export async function validateResume(file: Blob): Promise<"file" | "resume_size" | null> {
  if (file.size > MAX_RESUME_BYTES) return "resume_size";
  if (file.size === 0) return "file";
  // PDF readers permit a header within the first 1 KiB (including BOM/preamble).
  const header = new TextDecoder("latin1").decode(await file.slice(0, 1024).arrayBuffer());
  return /%PDF-(?:1\.[0-7]|2\.0)(?:\r|\n|\s)/.test(header) ? null : "file";
}
