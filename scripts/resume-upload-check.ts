import assert from "node:assert/strict";
import { MAX_RESUME_BYTES, validateResume } from "../src/lib/resume-upload";

async function main() {
  const pdf = "%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n";
  for (const type of ["application/pdf", "application/octet-stream", "application/x-pdf", ""]) {
    assert.equal(await validateResume(new File([pdf], "이력서.PDF", { type })), null, `PDF with MIME ${type}`);
  }
  assert.equal(await validateResume(new File(["\uFEFF%PDF-2.0\r\n%%EOF"], "cv.pdf")), null);
  assert.equal(await validateResume(new File(["not a PDF"], "cv.pdf", { type: "application/pdf" })), "file");
  assert.equal(await validateResume(new File([], "cv.pdf", { type: "application/pdf" })), "file");
  assert.equal(await validateResume(new Blob([pdf, new Uint8Array(MAX_RESUME_BYTES - pdf.length)])), null);
  assert.equal(await validateResume(new Blob([pdf, new Uint8Array(MAX_RESUME_BYTES)])), "resume_size");
  console.log("PASS resume uploads: MIME variants, uppercase filename, PDF 2.0/BOM, invalid/empty files, 8MB boundary and oversized PDF.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
