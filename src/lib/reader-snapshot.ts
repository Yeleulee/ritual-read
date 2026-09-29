import { fontById } from "@/lib/reader-themes";

const fontDataCache = new Map<string, Promise<string>>();

/* html-to-image renders into an <img>, which cannot load external fonts — inline the
   selected face as data URLs. Also skips html-to-image's slow stylesheet scan. */
export async function embeddedFontCss(fontId: string) {
  const f = fontById(fontId);
  if (!f.faces) return "";
  const parts = await Promise.all(
    f.faces.map(async ([w, st, file]) => {
      const url = `${location.origin}/fonts/${file}`;
      if (!fontDataCache.has(url)) {
        fontDataCache.set(
          url,
          fetch(url)
            .then((r) => r.blob())
            .then(
              (b) =>
                new Promise<string>((res) => {
                  const fr = new FileReader();
                  fr.onload = () => res(fr.result as string);
                  fr.readAsDataURL(b);
                }),
            ),
        );
      }
      const data = await fontDataCache.get(url)!;
      return `@font-face{font-family:${f.family.split(",")[0]};font-style:${st};font-weight:${w};src:url(${data}) format("woff2")}`;
    }),
  );
  return parts.join("\n");
}
