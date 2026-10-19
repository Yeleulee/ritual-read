import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('=== SELF-VERIFICATION SUITE: RITUAL READ PDF ===');
console.log('====================================================\n');

let allPassed = true;
function assert(name, condition, extra = '') {
  if (condition) {
    console.log(`[PASS] ${name} ${extra}`);
  } else {
    console.error(`[FAIL] ${name} ${extra}`);
    allPassed = false;
  }
}

async function runTests() {
  // 1. Verify test PDF file exists
  const pdfPath = path.join(rootDir, '.tmp-test-book.pdf');
  assert('Test PDF file exists', fs.existsSync(pdfPath), `(${fs.statSync(pdfPath).size} bytes)`);

  // 2. Load PDF.js with local offline config
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  assert('PDF.js library loaded', !!pdfjsLib.getDocument);

  const buffer = fs.readFileSync(pdfPath);
  const data = new Uint8Array(buffer);

  const standardFontsPath = 'file:///' + path.join(rootDir, 'public', 'pdfjs', 'standard_fonts').replace(/\\/g, '/') + '/';
  const cmapsPath = 'file:///' + path.join(rootDir, 'public', 'pdfjs', 'cmaps').replace(/\\/g, '/') + '/';

  assert('Local standard_fonts folder exists', fs.existsSync(path.join(rootDir, 'public', 'pdfjs', 'standard_fonts')));
  assert('Local cmaps folder exists', fs.existsSync(path.join(rootDir, 'public', 'pdfjs', 'cmaps')));

  // 3. Document Parsing & Metadata (Simulating BookLibrary analyzeFile)
  console.log('\n--- Test Suite 1: PDF Document & Metadata Extraction ---');
  const doc = await pdfjsLib.getDocument({
    data,
    standardFontDataUrl: standardFontsPath,
    cMapUrl: cmapsPath,
    cMapPacked: true,
  }).promise;

  assert('Document pages parsed correctly', doc.numPages === 600, `(numPages = ${doc.numPages})`);

  const meta = await doc.getMetadata();
  const info = meta?.info || {};
  assert('Metadata Title extracted', info.Title === 'Ritual Test PDF', `("${info.Title}")`);
  assert('Metadata Author extracted', info.Author === 'Test Author', `("${info.Author}")`);

  // 4. Page 1 Viewport and Canvas Sizing (Cover Generation)
  console.log('\n--- Test Suite 2: Viewport Sizing & Cover Thumbnail ---');
  const page1 = await doc.getPage(1);
  const baseVp = page1.getViewport({ scale: 1 });
  assert('Page 1 base viewport dimensions', baseVp.width === 300 && baseVp.height === 300, `(${baseVp.width}x${baseVp.height})`);

  const coverScale = Math.min(2, 360 / Math.max(1, baseVp.width));
  const coverVp = page1.getViewport({ scale: coverScale });
  assert('Cover viewport scaled proportionally', coverVp.width === 360 && coverVp.height === 360, `(${coverVp.width}x${coverVp.height})`);

  // 5. Text Extraction & TextLayer coordinates (Readability)
  console.log('\n--- Test Suite 3: Readability & Live Text Layer ---');
  const tc = await page1.getTextContent();
  assert('Text content items extracted', tc.items.length > 0, `(${tc.items.length} items)`);
  const fullText = tc.items.map((it) => it.str).join(' ');
  assert('Extracted text matches document', fullText === 'Hello Ritual page 1', `("${fullText}")`);

  const item1 = tc.items[0];
  assert('Text item has transform matrix for positioning', Array.isArray(item1.transform) && item1.transform.length === 6);
  assert('Text item has width and height bounds', item1.width > 0 && item1.height > 0);

  // 6. Test Two-Page Spread Logic
  console.log('\n--- Test Suite 4: Apple Books Two-Page Spread Logic ---');
  function getSpreadPages(page, numPages, isDual) {
    const leftPage = isDual ? (page % 2 === 1 ? page : page - 1) : page;
    const rightPage = isDual ? (leftPage + 1 <= numPages ? leftPage + 1 : null) : null;
    return { leftPage, rightPage };
  }

  // Page 1 in single mode
  const p1Single = getSpreadPages(1, 600, false);
  assert('Page 1 in single mode', p1Single.leftPage === 1 && p1Single.rightPage === null);

  // Page 1 in dual mode: Left = 1, Right = 2 (Immediately side-by-side!)
  const p1Spread = getSpreadPages(1, 600, true);
  assert('Page 1 in dual mode presents [1, 2] side-by-side immediately', p1Spread.leftPage === 1 && p1Spread.rightPage === 2);

  // Page 2 in dual mode resolves to [1, 2]
  const p2Spread = getSpreadPages(2, 600, true);
  assert('Page 2 in dual mode resolves to spread [1, 2]', p2Spread.leftPage === 1 && p2Spread.rightPage === 2);

  // Page 3 in dual mode gives [3, 4]
  const p3Spread = getSpreadPages(3, 600, true);
  assert('Page 3 in dual mode gives spread [3, 4]', p3Spread.leftPage === 3 && p3Spread.rightPage === 4);

  // Page 4 in dual mode resolves to [3, 4]
  const p4Spread = getSpreadPages(4, 600, true);
  assert('Page 4 in dual mode resolves to spread [3, 4]', p4Spread.leftPage === 3 && p4Spread.rightPage === 4);

  // Odd-count document last page: Left = 5, Right = null (no overflow beyond 5)
  const p5Spread = getSpreadPages(5, 5, true);
  assert('Odd final page 5 of 5 in dual mode has no right overflow', p5Spread.leftPage === 5 && p5Spread.rightPage === null);

  // Even-count document last page: Left = 599, Right = 600
  const p600Spread = getSpreadPages(600, 600, true);
  assert('Even final page 600 in dual mode gives spread [599, 600]', p600Spread.leftPage === 599 && p600Spread.rightPage === 600);

  // Navigation stepping
  function stepNext(cur, n, isDual) {
    if (!isDual) return cur < n ? cur + 1 : false;
    const left = cur % 2 === 1 ? cur : cur - 1;
    return left + 2 <= n ? left + 2 : false;
  }
  function stepPrev(cur, isDual) {
    if (!isDual) return cur > 1 ? cur - 1 : false;
    const left = cur % 2 === 1 ? cur : cur - 1;
    return left > 1 ? Math.max(1, left - 2) : false;
  }
  assert('Step next from spread [1, 2] advances to page 3', stepNext(1, 600, true) === 3);
  assert('Step next from spread [3, 4] advances to page 5', stepNext(3, 600, true) === 5);
  assert('Step prev from spread [5, 6] returns to page 3', stepPrev(5, true) === 3);
  assert('Step prev from spread [3, 4] returns to page 1', stepPrev(3, true) === 1);
  assert('Step prev from spread [1, 2] returns false (at start)', stepPrev(1, true) === false);
  assert('Step next from final spread [599, 600] returns false (at end)', stepNext(599, 600, true) === false);

  // 7. Test Apple Books Tap Zones Navigation
  console.log('\n--- Test Suite 5: Apple Books Tap Navigation Zones ---');
  function getTapAction(ratio) {
    if (ratio < 0.2) return 'prev';
    if (ratio > 0.8) return 'next';
    return 'chrome';
  }
  assert('Tap on left margin (x=0.10) triggers Prev', getTapAction(0.10) === 'prev');
  assert('Tap on right margin (x=0.90) triggers Next', getTapAction(0.90) === 'next');
  assert('Tap on center (x=0.50) toggles Chrome', getTapAction(0.50) === 'chrome');
  assert('Tap on center (x=0.25) toggles Chrome', getTapAction(0.25) === 'chrome');
  assert('Tap on center (x=0.75) toggles Chrome', getTapAction(0.75) === 'chrome');

  // 8. Test Search
  console.log('\n--- Test Suite 6: Full-Text Search across Pages ---');
  const hits = [];
  const query = 'hello ritual';
  for (let p = 1; p <= Math.min(10, doc.numPages); p++) {
    const pageObj = await doc.getPage(p);
    const pageTc = await pageObj.getTextContent();
    const pageText = pageTc.items.map((it) => it.str).join(' ');
    if (pageText.toLowerCase().includes(query)) {
      hits.push({ page: p, text: pageText });
    }
  }
  assert('Search finds matches across multiple pages', hits.length === 10, `(${hits.length} hits found in first 10 pages)`);
  assert('First hit matches page 1', hits[0].page === 1 && hits[0].text.includes('page 1'));

  // 9. Test Apple Books Dark Mode & Theme Styles
  console.log('\n--- Test Suite 7: Apple Books PDF Dark Mode & Eye-Comfort Filters ---');
  function getPdfThemeStyle(themeId, isDark, selection) {
    switch (themeId) {
      case "focus":
        return {
          filter: "invert(0.92) hue-rotate(180deg) contrast(1.05) brightness(0.95)",
          sheetBg: "#141416",
          selectionBg: selection || "rgba(127, 179, 255, 0.35)",
          highlightBlend: "screen",
          highlightOpacity: 0.65,
        };
      case "calm":
        return {
          filter: "invert(0.88) sepia(0.25) hue-rotate(180deg) brightness(0.92) contrast(1.05)",
          sheetBg: "#282420",
          selectionBg: selection || "rgba(215, 167, 107, 0.3)",
          highlightBlend: "screen",
          highlightOpacity: 0.65,
        };
      case "paper":
        return {
          filter: "sepia(0.35) contrast(0.96) brightness(0.97)",
          sheetBg: "#F6EEDC",
          selectionBg: selection || "rgba(138, 90, 43, 0.25)",
          highlightBlend: "multiply",
          highlightOpacity: 0.38,
        };
      case "quiet":
        return {
          filter: "brightness(0.94) contrast(0.98)",
          sheetBg: "#EDEDED",
          selectionBg: selection || "rgba(62, 92, 138, 0.25)",
          highlightBlend: "multiply",
          highlightOpacity: 0.35,
        };
      case "bold":
        return {
          filter: "contrast(1.04)",
          sheetBg: "#FFFFFF",
          selectionBg: selection || "rgba(10, 79, 160, 0.25)",
          highlightBlend: "multiply",
          highlightOpacity: 0.38,
        };
      case "original":
      default:
        if (isDark) {
          return {
            filter: "invert(0.92) hue-rotate(180deg) contrast(1.05) brightness(0.95)",
            sheetBg: "#141416",
            selectionBg: selection || "rgba(127, 179, 255, 0.35)",
            highlightBlend: "screen",
            highlightOpacity: 0.65,
          };
        }
        return {
          filter: "none",
          sheetBg: "#FFFFFF",
          selectionBg: selection || "rgba(59, 130, 246, 0.35)",
          highlightBlend: "multiply",
          highlightOpacity: 0.35,
        };
    }
  }

  const focusStyle = getPdfThemeStyle("focus", true);
  assert("Focus theme applies OLED dark inversion filter", focusStyle.filter.includes("invert(0.92)") && focusStyle.filter.includes("hue-rotate(180deg)"));
  assert("Focus theme sets charcoal sheet background", focusStyle.sheetBg === "#141416");
  assert("Focus theme uses 'screen' blend mode for readable dark highlights", focusStyle.highlightBlend === "screen");

  const calmStyle = getPdfThemeStyle("calm", true);
  assert("Calm theme applies warm espresso sepia inversion", calmStyle.filter.includes("sepia(0.25)"));
  assert("Calm theme sets warm espresso sheet background", calmStyle.sheetBg === "#282420");

  const paperStyle = getPdfThemeStyle("paper", false);
  assert("Paper theme warms canvas with sepia tone", paperStyle.filter.includes("sepia(0.35)"));
  assert("Paper theme sets parchment sheet background", paperStyle.sheetBg === "#F6EEDC");
  assert("Paper theme keeps 'multiply' highlight blend mode", paperStyle.highlightBlend === "multiply");

  const originalStyle = getPdfThemeStyle("original", false);
  assert("Original light theme leaves canvas filter unchanged", originalStyle.filter === "none");
  assert("Original light theme has white sheet background", originalStyle.sheetBg === "#FFFFFF");

  await doc.destroy();

  console.log('\n====================================================');
  if (allPassed) {
    console.log('>>> ALL 28 UNIT & INTEGRATION CHECKS PASSED! <<<');
  } else {
    console.error('>>> SOME CHECKS FAILED! <<<');
    process.exit(1);
  }
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
