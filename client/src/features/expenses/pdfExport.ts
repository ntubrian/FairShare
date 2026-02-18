import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";
import * as fontkit from "@pdf-lib/fontkit";

type RegisterFontkitArg = Parameters<PDFDocument["registerFontkit"]>[0];
type FontkitLike = {
  create: (...args: unknown[]) => unknown;
};

const resolveFontkit = (): RegisterFontkitArg => {
  const moduleValue = fontkit as unknown as {
    default?: Partial<FontkitLike>;
    create?: (...args: unknown[]) => unknown;
  };

  if (typeof moduleValue.create === "function") {
    return moduleValue as RegisterFontkitArg;
  }

  if (moduleValue.default && typeof moduleValue.default.create === "function") {
    return moduleValue.default as RegisterFontkitArg;
  }

  throw new Error("Unsupported fontkit module shape: missing create().");
};

type PdfRateRow = {
  currency: string;
  rate: number;
};

type PdfInstruction = {
  fromParticipantName: string;
  toParticipantName: string;
  amount: number;
  currency: string;
};

type PdfExpenseSplit = {
  participantName: string;
  amount: number | null;
  shares: number | null;
};

type PdfExpenseItem = {
  payerName: string;
  amount: number;
  currency: string;
  description: string | null;
  occurredAt: string;
  deletedAt: string | null;
  splits: PdfExpenseSplit[];
};

export type SettlementPdfInput = {
  projectName: string;
  exportTime: string;
  targetCurrency: string;
  rateSource: string;
  rateFetchedAt: string;
  rateRows: PdfRateRow[];
  instructions: PdfInstruction[];
  expenses: PdfExpenseItem[];
  includeSoftDeleted: boolean;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN_LEFT = 44;
const PAGE_MARGIN_RIGHT = 44;
const PAGE_MARGIN_TOP = 52;
const PAGE_MARGIN_BOTTOM = 44;
const PAGE_HEADER_HEIGHT = 56;
const PAGE_FOOTER_RESERVED = 18;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN_LEFT - PAGE_MARGIN_RIGHT;
const CONTENT_TOP = PAGE_HEIGHT - PAGE_MARGIN_TOP - PAGE_HEADER_HEIGHT;
const CONTENT_BOTTOM = PAGE_MARGIN_BOTTOM + PAGE_FOOTER_RESERVED;

const TITLE_SIZE = 22;
const SECTION_TITLE_SIZE = 12;
const BODY_SIZE = 10.5;
const SMALL_SIZE = 9.5;

const TITLE_LINE_HEIGHT = 28;
const BODY_LINE_HEIGHT = 15;
const SMALL_LINE_HEIGHT = 13;

const COLORS = {
  text: [0.12, 0.13, 0.16] as const,
  mutedText: [0.42, 0.45, 0.5] as const,
  headerLine: [0.2, 0.35, 0.62] as const,
  sectionBg: [0.94, 0.96, 0.99] as const,
  cardBg: [0.98, 0.98, 0.99] as const,
  cardBorder: [0.86, 0.89, 0.93] as const,
};

// Temporary diagnostics switch for PDF export debugging.
const PDF_DEBUGGER_ENABLED = false;
let didBreakOnUnsupportedGlyph = false;

const PDF_CJK_CHAR_PATTERN = /[\u3400-\u9fff]/;
const PDF_SUSPICIOUS_QUESTION_PATTERN = /\?{2,}|�/;

type GoogleFontUrls = {
  regular: string;
  bold: string;
};

const buildPublicAssetUrl = (path: string) => {
  const base =
    typeof process !== "undefined" &&
    typeof process.env?.PUBLIC_URL === "string"
      ? process.env.PUBLIC_URL.replace(/\/$/, "")
      : "";
  return `${base}${path}`;
};

const LOCAL_FONT_URLS: GoogleFontUrls = {
  regular: buildPublicAssetUrl("/fonts/NotoSansTC-Regular.ttf"),
  bold: buildPublicAssetUrl("/fonts/NotoSansTC-Bold.ttf"),
};

const GOOGLE_FONT_FALLBACK_URLS: GoogleFontUrls = {
  regular:
    "https://fonts.gstatic.com/s/notosanstc/v39/-nFuOG829Oofr2wohFbTp9ifNAn722rq0MXz76Cy_Co.ttf",
  bold: "https://fonts.gstatic.com/s/notosanstc/v39/-nFuOG829Oofr2wohFbTp9ifNAn722rq0MXz70e1_Co.ttf",
};

const fontBinaryCache = new Map<string, Promise<ArrayBuffer>>();
const fontCharSupportCache = new WeakMap<PDFFont, Map<string, boolean>>();

type FontFamily = {
  asciiRegular: PDFFont;
  asciiBold: PDFFont;
  regular: PDFFont;
  bold: PDFFont;
};

type PageState = {
  page: PDFPage;
  cursorY: number;
};

const collectInputTextSamples = (input: SettlementPdfInput) => {
  const samples: string[] = [
    input.projectName,
    input.targetCurrency,
    input.rateSource,
    ...input.rateRows.map((row) => row.currency),
    ...input.instructions.flatMap((item) => [
      item.fromParticipantName,
      item.toParticipantName,
      item.currency,
    ]),
  ];

  for (const expense of input.expenses) {
    samples.push(
      expense.payerName,
      expense.currency,
      expense.description ?? "",
      ...expense.splits.map((split) => split.participantName)
    );
  }

  return samples.map((item) => normalizeText(item)).filter(Boolean);
};

const pickFirstCjkChar = (samples: string[]) => {
  for (const sample of samples) {
    for (const char of sample) {
      if (PDF_CJK_CHAR_PATTERN.test(char)) {
        return char;
      }
    }
  }
  return null;
};

const containsCjkText = (value: string) => PDF_CJK_CHAR_PATTERN.test(value);

const pickFontForText = (
  fonts: FontFamily,
  weight: "regular" | "bold",
  text: string
): PDFFont => {
  if (containsCjkText(text)) {
    return weight === "bold" ? fonts.bold : fonts.regular;
  }
  return weight === "bold" ? fonts.asciiBold : fonts.asciiRegular;
};

const normalizeText = (value: string) =>
  value
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const canEncodeChar = (font: PDFFont, char: string) => {
  let cache = fontCharSupportCache.get(font);
  if (!cache) {
    cache = new Map<string, boolean>();
    fontCharSupportCache.set(font, cache);
  }

  const cached = cache.get(char);
  if (cached !== undefined) {
    return cached;
  }

  let supported = true;
  try {
    font.encodeText(char);
  } catch {
    supported = false;
  }
  cache.set(char, supported);
  return supported;
};

const normalizeTextForFont = (font: PDFFont, value: string) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }

  try {
    font.encodeText(normalized);
    return normalized;
  } catch {
    let safe = "";
    let replaced = false;
    for (const char of normalized) {
      const supported = canEncodeChar(font, char);
      safe += supported ? char : "?";
      if (!supported) {
        replaced = true;
      }
    }

    if (replaced && PDF_DEBUGGER_ENABLED && !didBreakOnUnsupportedGlyph) {
      didBreakOnUnsupportedGlyph = true;
      // Break on first glyph replacement so we can inspect original input and font state.
      // eslint-disable-next-line no-debugger
      debugger;
    }

    return safe;
  }
};

const formatDateTime = (iso: string) => {
  const parsed = new Date(iso);
  if (!Number.isFinite(parsed.getTime())) {
    return "Unknown time";
  }

  const pad2 = (value: number) => value.toString().padStart(2, "0");
  const year = parsed.getFullYear();
  const month = pad2(parsed.getMonth() + 1);
  const day = pad2(parsed.getDate());
  const hour = pad2(parsed.getHours());
  const minute = pad2(parsed.getMinutes());
  return `${year}-${month}-${day} ${hour}:${minute}`;
};

const formatAmount = (value: number) => {
  if (!Number.isFinite(value)) {
    return "0.00";
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const toRgb = (color: readonly [number, number, number]) =>
  rgb(color[0], color[1], color[2]);

const wrapText = (
  font: PDFFont,
  fontSize: number,
  value: string,
  maxWidth: number
) => {
  const safe = normalizeTextForFont(font, value);
  if (!safe) {
    return [""];
  }

  const lines: string[] = [];
  const words = safe.split(" ");
  let current = "";

  const pushCurrent = () => {
    if (current) {
      lines.push(current);
      current = "";
    }
  };

  for (const word of words) {
    if (!word) {
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      pushCurrent();
    }

    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      current = word;
      continue;
    }

    let fragment = "";
    for (const char of word) {
      const next = fragment + char;
      if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
        fragment = next;
      } else {
        if (fragment) {
          lines.push(fragment);
        }
        fragment = char;
      }
    }
    current = fragment;
  }

  pushCurrent();
  return lines.length ? lines : [""];
};

const drawText = (
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  options: {
    font: PDFFont;
    fontSize: number;
    color: readonly [number, number, number];
  }
) => {
  const safeText = normalizeTextForFont(options.font, text);
  if (!safeText) {
    return;
  }

  page.drawText(safeText, {
    x,
    y,
    font: options.font,
    size: options.fontSize,
    color: toRgb(options.color),
  });
};

const drawFilledRect = (
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  color: readonly [number, number, number]
) => {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: toRgb(color),
  });
};

const drawRectStroke = (
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  color: readonly [number, number, number],
  lineWidth: number
) => {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderWidth: lineWidth,
    borderColor: toRgb(color),
  });
};

const drawLine = (
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: readonly [number, number, number],
  lineWidth = 1
) => {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness: lineWidth,
    color: toRgb(color),
  });
};

const createPage = (pdf: PDFDocument): PageState => ({
  page: pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
  cursorY: CONTENT_TOP,
});

const FONT_MAGIC_HEADERS: number[][] = [
  [0x00, 0x01, 0x00, 0x00], // TrueType
  [0x4f, 0x54, 0x54, 0x4f], // OpenType ("OTTO")
  [0x74, 0x74, 0x63, 0x66], // TrueType Collection ("ttcf")
  [0x77, 0x4f, 0x46, 0x46], // WOFF ("wOFF")
  [0x77, 0x4f, 0x46, 0x32], // WOFF2 ("wOF2")
];

const isLikelyFontBinary = (bytes: ArrayBuffer) => {
  const header = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
  return FONT_MAGIC_HEADERS.some(
    (signature) =>
      header.length === signature.length &&
      signature.every((value, index) => header[index] === value)
  );
};

const fetchArrayBuffer = (url: string) => {
  const existing = fontBinaryCache.get(url);
  if (existing) {
    return existing;
  }

  const pending = (async () => {
    // Prefer bypassing conditional cache revalidation so we don't hit 304 responses
    // with empty bodies during font embedding.
    let response = await fetch(url, { cache: "no-store" });
    if (response.status === 304) {
      response = await fetch(url, { cache: "reload" });
    }
    if (!response.ok) {
      throw new Error(
        `Font download failed: ${response.status} ${response.statusText}`
      );
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0) {
      throw new Error("Font download returned empty content.");
    }
    if (!isLikelyFontBinary(bytes)) {
      throw new Error("Downloaded asset is not a valid font binary.");
    }
    return bytes;
  })();

  fontBinaryCache.set(url, pending);
  return pending;
};

const uniqueUrls = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean)));

type FontSource = {
  url: string;
  bytes: ArrayBuffer;
};

const fetchFirstAvailableFontSource = async (
  urls: string[]
): Promise<FontSource> => {
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const bytes = await fetchArrayBuffer(url);
      return { url, bytes };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Unable to load font from any source.");
};

const loadFonts = async (
  pdf: PDFDocument,
  cjkProbeChar: string | null
): Promise<FontFamily> => {
  pdf.registerFontkit(resolveFontkit());
  const [asciiRegular, asciiBold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ]);

  try {
    const localUrls = typeof window !== "undefined" ? LOCAL_FONT_URLS : null;
    const regularCandidates = uniqueUrls([
      localUrls?.regular ?? "",
      GOOGLE_FONT_FALLBACK_URLS.regular,
    ]);
    const boldCandidates = uniqueUrls([
      localUrls?.bold ?? "",
      GOOGLE_FONT_FALLBACK_URLS.bold,
    ]);

    const [regularSource, boldSource] = await Promise.all([
      fetchFirstAvailableFontSource(regularCandidates),
      fetchFirstAvailableFontSource(boldCandidates),
    ]);

    const shouldSubset = cjkProbeChar === null;
    const [regular, bold] = await Promise.all([
      pdf.embedFont(regularSource.bytes, { subset: shouldSubset }),
      pdf.embedFont(boldSource.bytes, { subset: shouldSubset }),
    ]);

    if (cjkProbeChar) {
      const regularSupported = canEncodeChar(regular, cjkProbeChar);
      const boldSupported = canEncodeChar(bold, cjkProbeChar);
      if (!regularSupported || !boldSupported) {
        throw new Error(
          `Loaded font cannot encode CJK probe char: ${cjkProbeChar}`
        );
      }
    }

    if (PDF_DEBUGGER_ENABLED) {
      console.info("[pdfExport] font load diagnostics", {
        cjkProbeChar,
        shouldSubset,
        regularUrl: regularSource.url,
        boldUrl: boldSource.url,
      });
    }

    return { asciiRegular, asciiBold, regular, bold };
  } catch (error) {
    if (PDF_DEBUGGER_ENABLED) {
      console.error("[pdfExport] custom font load failed", error);
    }
    if (cjkProbeChar) {
      throw new Error("Unable to load CJK-capable font for PDF export.");
    }
    if (PDF_DEBUGGER_ENABLED) {
      // eslint-disable-next-line no-debugger
      debugger;
    }
    return {
      asciiRegular,
      asciiBold,
      regular: asciiRegular,
      bold: asciiBold,
    };
  }
};

const renderPageChrome = (
  page: PDFPage,
  fonts: FontFamily,
  pageIndex: number,
  pageCount: number,
  projectName: string
) => {
  const safeProjectName = normalizeText(projectName) || "Untitled project";

  drawLine(
    page,
    PAGE_MARGIN_LEFT,
    PAGE_HEIGHT - PAGE_MARGIN_TOP + 8,
    PAGE_WIDTH - PAGE_MARGIN_RIGHT,
    PAGE_HEIGHT - PAGE_MARGIN_TOP + 8,
    COLORS.headerLine,
    1.2
  );

  drawText(page, safeProjectName, PAGE_MARGIN_LEFT, PAGE_HEIGHT - 42, {
    font: pickFontForText(fonts, "regular", safeProjectName),
    fontSize: SMALL_SIZE,
    color: COLORS.mutedText,
  });

  drawLine(
    page,
    PAGE_MARGIN_LEFT,
    PAGE_MARGIN_BOTTOM - 10,
    PAGE_WIDTH - PAGE_MARGIN_RIGHT,
    PAGE_MARGIN_BOTTOM - 10,
    COLORS.cardBorder,
    0.8
  );

  const pageText = `Page ${pageIndex} / ${pageCount}`;
  drawText(
    page,
    pageText,
    PAGE_WIDTH - PAGE_MARGIN_RIGHT - 72,
    PAGE_MARGIN_BOTTOM - 28,
    {
      font: pickFontForText(fonts, "regular", pageText),
      fontSize: SMALL_SIZE,
      color: COLORS.mutedText,
    }
  );
};

export const createSettlementPdfBlob = async (
  input: SettlementPdfInput
): Promise<Blob> => {
  const samples = collectInputTextSamples(input);
  const cjkProbeChar = pickFirstCjkChar(samples);

  if (PDF_DEBUGGER_ENABLED) {
    didBreakOnUnsupportedGlyph = false;
    const samplesWithCjk = samples.filter((item) =>
      PDF_CJK_CHAR_PATTERN.test(item)
    );
    const suspiciousSamples = samples.filter((item) =>
      PDF_SUSPICIOUS_QUESTION_PATTERN.test(item)
    );

    console.info("[pdfExport] input text diagnostics", {
      sampleCount: samples.length,
      cjkProbeChar,
      cjkSampleCount: samplesWithCjk.length,
      suspiciousSampleCount: suspiciousSamples.length,
      suspiciousExamples: suspiciousSamples.slice(0, 6),
      cjkExamples: samplesWithCjk.slice(0, 6),
    });

    if (suspiciousSamples.length > 0 && samplesWithCjk.length === 0) {
      // Data likely became "???" before PDF rendering.
      // eslint-disable-next-line no-debugger
      debugger;
    }
  }

  const pdf = await PDFDocument.create();
  const fonts = await loadFonts(pdf, cjkProbeChar);

  const pages: PageState[] = [];
  let page = createPage(pdf);

  const startNewPage = () => {
    pages.push(page);
    page = createPage(pdf);
  };

  const ensureSpace = (requiredHeight: number) => {
    if (page.cursorY - requiredHeight < CONTENT_BOTTOM) {
      startNewPage();
    }
  };

  const writeWrappedText = (
    text: string,
    options: {
      x?: number;
      width?: number;
      font?: "regular" | "bold";
      fontSize?: number;
      lineHeight?: number;
      color?: readonly [number, number, number];
      marginBottom?: number;
    } = {}
  ) => {
    const x = options.x ?? PAGE_MARGIN_LEFT;
    const width = options.width ?? CONTENT_WIDTH;
    const font = pickFontForText(
      fonts,
      options.font === "bold" ? "bold" : "regular",
      text
    );
    const fontSize = options.fontSize ?? BODY_SIZE;
    const lineHeight = options.lineHeight ?? BODY_LINE_HEIGHT;
    const color = options.color ?? COLORS.text;
    const marginBottom = options.marginBottom ?? 0;

    const lines = wrapText(font, fontSize, text, width);
    const blockHeight = lines.length * lineHeight + marginBottom;
    ensureSpace(blockHeight);

    let y = page.cursorY;
    for (const line of lines) {
      drawText(page.page, line, x, y, { font, fontSize, color });
      y -= lineHeight;
    }

    page.cursorY = y - marginBottom;
  };

  const writeSectionTitle = (title: string) => {
    ensureSpace(40);

    const rectHeight = 22;
    const rectTop = page.cursorY;
    const rectBottom = rectTop - rectHeight;

    drawFilledRect(
      page.page,
      PAGE_MARGIN_LEFT,
      rectBottom + 2,
      CONTENT_WIDTH,
      rectHeight,
      COLORS.sectionBg
    );
    drawRectStroke(
      page.page,
      PAGE_MARGIN_LEFT,
      rectBottom + 2,
      CONTENT_WIDTH,
      rectHeight,
      COLORS.cardBorder,
      0.8
    );

    drawText(page.page, title, PAGE_MARGIN_LEFT + 10, rectTop - 12, {
      font: pickFontForText(fonts, "bold", title),
      fontSize: SECTION_TITLE_SIZE,
      color: COLORS.text,
    });

    page.cursorY = rectBottom - 10;
  };

  const writeMetadataCard = () => {
    const rows = [
      { label: "Project", value: input.projectName || "Untitled project" },
      { label: "Export Time", value: formatDateTime(input.exportTime) },
      { label: "Target Currency", value: input.targetCurrency },
      { label: "Rate Source", value: input.rateSource },
      {
        label: "Rate Snapshot Time",
        value: formatDateTime(input.rateFetchedAt),
      },
    ];

    const cardPadding = 12;
    const labelWidth = 132;
    const cardInnerWidth = CONTENT_WIDTH - cardPadding * 2;
    const valueWidth = cardInnerWidth - labelWidth;

    const prepared = rows.map((row) => ({
      label: row.label,
      valueFont: pickFontForText(fonts, "regular", row.value),
      valueLines: wrapText(
        pickFontForText(fonts, "regular", row.value),
        BODY_SIZE,
        row.value,
        valueWidth
      ),
    }));

    const rowGap = 4;
    const totalTextHeight = prepared.reduce(
      (sum, row) => sum + Math.max(1, row.valueLines.length) * BODY_LINE_HEIGHT,
      0
    );
    const boxHeight =
      cardPadding * 2 + totalTextHeight + rowGap * (prepared.length - 1);

    ensureSpace(boxHeight + 10);

    const boxTop = page.cursorY;
    const boxBottom = boxTop - boxHeight;

    drawFilledRect(
      page.page,
      PAGE_MARGIN_LEFT,
      boxBottom,
      CONTENT_WIDTH,
      boxHeight,
      COLORS.cardBg
    );
    drawRectStroke(
      page.page,
      PAGE_MARGIN_LEFT,
      boxBottom,
      CONTENT_WIDTH,
      boxHeight,
      COLORS.cardBorder,
      0.8
    );

    const labelX = PAGE_MARGIN_LEFT + cardPadding;
    const valueX = labelX + labelWidth;
    let y = boxTop - cardPadding - 2;

    for (const row of prepared) {
      drawText(page.page, row.label, labelX, y, {
        font: pickFontForText(fonts, "bold", row.label),
        fontSize: BODY_SIZE,
        color: COLORS.text,
      });

      for (const [index, line] of row.valueLines.entries()) {
        drawText(page.page, line, valueX, y - index * BODY_LINE_HEIGHT, {
          font: row.valueFont,
          fontSize: BODY_SIZE,
          color: COLORS.text,
        });
      }

      y -= Math.max(1, row.valueLines.length) * BODY_LINE_HEIGHT + rowGap;
    }

    page.cursorY = boxBottom - 12;
  };

  const writeRateTable = () => {
    if (input.rateRows.length === 0) {
      writeWrappedText("No rates found in snapshot.", {
        color: COLORS.mutedText,
        marginBottom: 6,
      });
      return;
    }

    const rowHeight = 20;
    const headerHeight = 22;
    const boxHeight = headerHeight + rowHeight * input.rateRows.length;

    ensureSpace(boxHeight + 10);

    const boxTop = page.cursorY;
    const boxBottom = boxTop - boxHeight;
    const col1Width = 120;

    drawRectStroke(
      page.page,
      PAGE_MARGIN_LEFT,
      boxBottom,
      CONTENT_WIDTH,
      boxHeight,
      COLORS.cardBorder,
      0.8
    );
    drawFilledRect(
      page.page,
      PAGE_MARGIN_LEFT,
      boxTop - headerHeight,
      CONTENT_WIDTH,
      headerHeight,
      COLORS.sectionBg
    );
    drawLine(
      page.page,
      PAGE_MARGIN_LEFT + col1Width,
      boxBottom,
      PAGE_MARGIN_LEFT + col1Width,
      boxTop,
      COLORS.cardBorder,
      0.8
    );

    drawText(page.page, "Currency", PAGE_MARGIN_LEFT + 8, boxTop - 15, {
      font: pickFontForText(fonts, "bold", "Currency"),
      fontSize: BODY_SIZE,
      color: COLORS.text,
    });

    drawText(
      page.page,
      "Converted Value",
      PAGE_MARGIN_LEFT + col1Width + 8,
      boxTop - 15,
      {
        font: pickFontForText(fonts, "bold", "Converted Value"),
        fontSize: BODY_SIZE,
        color: COLORS.text,
      }
    );

    for (let index = 0; index < input.rateRows.length; index += 1) {
      const y = boxTop - headerHeight - index * rowHeight;

      if (index > 0) {
        drawLine(
          page.page,
          PAGE_MARGIN_LEFT,
          y,
          PAGE_MARGIN_LEFT + CONTENT_WIDTH,
          y,
          COLORS.cardBorder,
          0.6
        );
      }

      const row = input.rateRows[index];

      drawText(page.page, row.currency, PAGE_MARGIN_LEFT + 8, y - 14, {
        font: pickFontForText(fonts, "regular", row.currency),
        fontSize: BODY_SIZE,
        color: COLORS.text,
      });

      const convertedText = `1 ${row.currency} = ${formatAmount(row.rate)} ${
        input.targetCurrency
      }`;
      drawText(
        page.page,
        convertedText,
        PAGE_MARGIN_LEFT + col1Width + 8,
        y - 14,
        {
          font: pickFontForText(fonts, "regular", convertedText),
          fontSize: BODY_SIZE,
          color: COLORS.text,
        }
      );
    }

    page.cursorY = boxBottom - 12;
  };

  const writeBulletList = (items: string[], emptyMessage: string) => {
    if (!items.length) {
      writeWrappedText(emptyMessage, {
        color: COLORS.mutedText,
        marginBottom: 6,
      });
      return;
    }

    for (let index = 0; index < items.length; index += 1) {
      writeWrappedText(`${index + 1}. ${items[index]}`, {
        fontSize: BODY_SIZE,
        lineHeight: BODY_LINE_HEIGHT,
        marginBottom: 2,
      });
    }

    page.cursorY -= 4;
  };

  const writeExpenseCard = (index: number, expense: PdfExpenseItem) => {
    const title = `#${index + 1} ${
      expense.description?.trim() || "No description"
    }  •  ${formatAmount(expense.amount)} ${expense.currency}`;
    const details: string[] = [
      `Payer: ${expense.payerName}`,
      `Date: ${formatDateTime(expense.occurredAt)}`,
    ];

    if (expense.deletedAt) {
      details.push(
        `Status: Soft deleted on ${formatDateTime(expense.deletedAt)}`
      );
    }

    if (expense.splits.length === 0) {
      details.push("Split: Not provided");
    } else {
      details.push("Splits:");
      for (const split of expense.splits) {
        const splitParts: string[] = [];
        if (split.amount !== null) {
          splitParts.push(`amount ${formatAmount(split.amount)}`);
        }
        if (split.shares !== null) {
          splitParts.push(`shares ${formatAmount(split.shares)}`);
        }
        const splitValue = splitParts.length ? splitParts.join(", ") : "equal";
        details.push(`- ${split.participantName}: ${splitValue}`);
      }
    }

    const cardPadding = 10;
    const contentWidth = CONTENT_WIDTH - cardPadding * 2;
    const titleFont = pickFontForText(fonts, "bold", title);
    const titleLines = wrapText(titleFont, BODY_SIZE, title, contentWidth);
    const detailItems = details.flatMap((line) => {
      const fontSize = line.startsWith("- ") ? SMALL_SIZE : BODY_SIZE;
      const font = pickFontForText(fonts, "regular", line);
      return wrapText(font, fontSize, line, contentWidth).map((wrapped) => ({
        text: wrapped,
        font,
        fontSize,
        isSubLine: wrapped.startsWith("- "),
      }));
    });

    const cardHeight =
      cardPadding * 2 +
      titleLines.length * BODY_LINE_HEIGHT +
      6 +
      detailItems.length * BODY_LINE_HEIGHT;

    ensureSpace(cardHeight + 10);

    const boxTop = page.cursorY;
    const boxBottom = boxTop - cardHeight;

    drawFilledRect(
      page.page,
      PAGE_MARGIN_LEFT,
      boxBottom,
      CONTENT_WIDTH,
      cardHeight,
      COLORS.cardBg
    );
    drawRectStroke(
      page.page,
      PAGE_MARGIN_LEFT,
      boxBottom,
      CONTENT_WIDTH,
      cardHeight,
      COLORS.cardBorder,
      0.8
    );

    let y = boxTop - cardPadding - 2;
    for (const line of titleLines) {
      drawText(page.page, line, PAGE_MARGIN_LEFT + cardPadding, y, {
        font: titleFont,
        fontSize: BODY_SIZE,
        color: COLORS.text,
      });
      y -= BODY_LINE_HEIGHT;
    }

    y -= 4;
    for (const detail of detailItems) {
      drawText(page.page, detail.text, PAGE_MARGIN_LEFT + cardPadding, y, {
        font: detail.font,
        fontSize: detail.fontSize,
        color: detail.isSubLine ? COLORS.mutedText : COLORS.text,
      });
      y -= BODY_LINE_HEIGHT;
    }

    page.cursorY = boxBottom - 10;
  };

  writeWrappedText("FairShare Settlement Export", {
    font: "bold",
    fontSize: TITLE_SIZE,
    lineHeight: TITLE_LINE_HEIGHT,
    marginBottom: 2,
  });

  writeWrappedText(`Generated ${formatDateTime(input.exportTime)}`, {
    font: "regular",
    fontSize: SMALL_SIZE,
    lineHeight: SMALL_LINE_HEIGHT,
    color: COLORS.mutedText,
    marginBottom: 12,
  });

  writeMetadataCard();

  writeSectionTitle("Rate Snapshot");
  writeRateTable();

  writeSectionTitle("Settlement Instructions");
  writeBulletList(
    input.instructions.map(
      (instruction) =>
        `${instruction.fromParticipantName} pays ${
          instruction.toParticipantName
        } ${formatAmount(instruction.amount)} ${instruction.currency}`
    ),
    "No payment required."
  );

  writeSectionTitle(
    `Expense Details (${
      input.includeSoftDeleted ? "including soft-deleted" : "active only"
    })`
  );

  if (input.expenses.length === 0) {
    writeWrappedText("No expenses found for this export.", {
      color: COLORS.mutedText,
      marginBottom: 6,
    });
  } else {
    for (let index = 0; index < input.expenses.length; index += 1) {
      writeExpenseCard(index, input.expenses[index]);
    }
  }

  pages.push(page);

  for (let index = 0; index < pages.length; index += 1) {
    renderPageChrome(
      pages[index].page,
      fonts,
      index + 1,
      pages.length,
      input.projectName
    );
  }

  const pdfBytes = await pdf.save();
  const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(pdfBuffer).set(pdfBytes);
  return new Blob([pdfBuffer], { type: "application/pdf" });
};
