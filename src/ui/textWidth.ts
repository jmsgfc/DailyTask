/**
 * 文字宽度测量：浏览器用 canvas 精确测量，测试 / 无 canvas 环境用确定性估算。
 * 结果按「字号 + 文本」缓存，任务表和列宽计算可放心重复调用。
 */

const FALLBACK_FONT_FAMILY =
  'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif';

let fontFamily: string | null = null;
let canvasContext: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, number>();

function getFontFamily(): string {
  if (fontFamily !== null) {
    return fontFamily;
  }
  if (typeof document !== "undefined" && document.body) {
    const computed = getComputedStyle(document.body).fontFamily;
    if (computed) {
      fontFamily = computed;
      return computed;
    }
  }
  fontFamily = FALLBACK_FONT_FAMILY;
  return fontFamily;
}

function isCanvasAvailable(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  if (
    typeof navigator !== "undefined" &&
    /jsdom/i.test(navigator.userAgent)
  ) {
    return false;
  }
  return typeof document.createElement("canvas").getContext === "function";
}

function getCanvasContext(): CanvasRenderingContext2D | null {
  if (canvasContext !== undefined) {
    return canvasContext;
  }
  canvasContext = null;
  if (!isCanvasAvailable()) {
    return canvasContext;
  }
  try {
    canvasContext = document.createElement("canvas").getContext("2d");
  } catch {
    canvasContext = null;
  }
  return canvasContext;
}

function isWideChar(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe4f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  );
}

/** 无 canvas 时的估算：中日韩字符按全角，ASCII 按常见字宽比例。 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (char === " " || char === "\t") {
      width += fontSize * 0.33;
    } else if (isWideChar(codePoint)) {
      width += fontSize;
    } else if (codePoint >= 0x41 && codePoint <= 0x5a) {
      width += fontSize * 0.62;
    } else if (codePoint >= 0x30 && codePoint <= 0x39) {
      width += fontSize * 0.62;
    } else {
      width += fontSize * 0.55;
    }
  }
  return width;
}

export function measureTextWidth(text: string, fontSize: number): number {
  if (!text) {
    return 0;
  }
  const key = `${fontSize}|${text}`;
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const context = getCanvasContext();
  let width: number;
  if (context) {
    context.font = `${fontSize}px ${getFontFamily()}`;
    width = context.measureText(text).width;
  } else {
    width = estimateTextWidth(text, fontSize);
  }

  cache.set(key, width);
  return width;
}
