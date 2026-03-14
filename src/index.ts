export type ArrayBufferReadable = {
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export type BinaryInput = Uint8Array | ArrayBuffer | ArrayBufferReadable;
export type BrowserFileInput = BinaryInput;
export type NodeFileInput = string | BinaryInput;
export type FileInput = NodeFileInput;
export type JsonObject = Record<string, unknown>;

export interface WorldEntryInfo {
  raw: JsonObject;
  uid: number | string | undefined;
  keys: string[];
  secondaryKeys: string[];
  comment: string;
  content: string;
  enabled: boolean;
  order: number | undefined;
  position: number | string | undefined;
  probability: number | undefined;
  depth: number | undefined;
}

export interface WorldInfo {
  raw: JsonObject;
  name: string;
  entries: WorldEntryInfo[];
  entryCount: number;
}

export interface CharacterInfo {
  raw: JsonObject;
  data: JsonObject | null;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  exampleMessages: string;
  tags: string[];
  creatorComment: string;
  avatar: string;
  spec: string;
  specVersion: string;
  worldInfo: WorldInfo | null;
}

export interface PresetsInfo {
  raw: JsonObject;
  source: string;
  model: string;
  temperature: number | undefined;
  topP: number | undefined;
  topK: number | undefined;
  minP: number | undefined;
  maxContext: number | undefined;
  maxTokens: number | undefined;
  seed: number | undefined;
  stream: boolean | undefined;
}

export type PathSegment = string | number;
export type PathInput = string | PathSegment[];

const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const textDecoder = new TextDecoder("utf-8");

/**
 * 判断当前运行时是否为 Node.js。
 * @returns 是否为 Node.js 环境。
 */
function isNodeRuntime(): boolean {
  return typeof process !== "undefined" && Boolean(process.versions?.node);
}

/**
 * 在 Node.js 环境下通过路径读取文件内容。
 * @param path 文件路径。
 * @returns 文件二进制数据。
 * @throws 当运行时不是 Node.js 时抛出错误。
 */
async function readFileFromPath(path: string): Promise<Uint8Array> {
  if (!isNodeRuntime()) {
    throw new Error("浏览器环境不支持通过路径读取文件，请传入 File、Blob、Uint8Array（Node Buffer）或 ArrayBuffer");
  }

  const { readFile } = await import("node:fs/promises");
  const buffer = await readFile(path);
  return new Uint8Array(buffer);
}

/**
 * 对 deflate 数据进行解压，优先使用浏览器 DecompressionStream。
 * @param input 待解压的二进制数据。
 * @returns 解压后的二进制数据。
 * @throws 当当前环境不支持解压能力时抛出错误。
 */
async function inflateDeflate(input: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "undefined") {
    const stableInput = new Uint8Array(input);
    const stream = new Blob([stableInput]).stream().pipeThrough(new DecompressionStream("deflate"));
    const output = await new Response(stream).arrayBuffer();
    return new Uint8Array(output);
  }

  if (isNodeRuntime()) {
    const { inflateSync } = await import("node:zlib");
    return inflateSync(input);
  }

  throw new Error("当前环境不支持 zlib 解压");
}

/**
 * 将 Base64 字符串解码为 UTF-8 文本。
 * @param value Base64 编码字符串。
 * @returns 解码后的文本内容。
 * @throws 当当前环境不支持 Base64 解码时抛出错误。
 */
function decodeBase64ToText(value: string): string {
  if (typeof atob === "function") {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return textDecoder.decode(bytes);
  }

  const bufferLike = (globalThis as { Buffer?: { from: (input: string, encoding: string) => Uint8Array } }).Buffer;
  if (bufferLike) {
    return textDecoder.decode(bufferLike.from(value, "base64"));
  }

  throw new Error("当前环境不支持 Base64 解码");
}

/**
 * 将文件输入统一转换为 Uint8Array。
 * @param input 支持的文件输入类型。
 * @returns 对应的二进制数据。
 * @throws 当输入为字符串路径时抛出错误，提示调用方先读取文件。
 */
function asUint8Array(input: Uint8Array | ArrayBuffer): Uint8Array {
  if (input instanceof Uint8Array) {
    return input;
  }

  return new Uint8Array(input);
}

/**
 * 判断值是否实现了 arrayBuffer 方法。
 * @param value 待判断值。
 * @returns 是否为可读取 ArrayBuffer 的对象。
 */
function isArrayBufferReadable(value: unknown): value is ArrayBufferReadable {
  if (!value || typeof value !== "object") {
    return false;
  }

  return typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function";
}

/**
 * 读取输入并返回二进制内容。
 * @param input 文件路径或二进制内容。
 * @returns 读取后的 Uint8Array。
 */
async function readInputBytes(input: FileInput): Promise<Uint8Array> {
  if (typeof input === "string") {
    return readFileFromPath(input);
  }

  if (isArrayBufferReadable(input)) {
    return new Uint8Array(await input.arrayBuffer());
  }

  return asUint8Array(input);
}

/**
 * 判断二进制数据是否以前缀签名开头。
 * @param buffer 待检测数据。
 * @param signature 目标签名。
 * @returns 是否匹配。
 */
function bufferStartsWith(buffer: Uint8Array, signature: Uint8Array): boolean {
  if (buffer.length < signature.length) {
    return false;
  }

  for (let i = 0; i < signature.length; i += 1) {
    if (buffer[i] !== signature[i]) {
      return false;
    }
  }

  return true;
}

/**
 * 在指定起始位置后查找第一个空字节。
 * @param buffer 待查找的二进制数据。
 * @param start 起始偏移。
 * @returns 空字节索引，未找到返回 -1。
 */
function findNullByteIndex(buffer: Uint8Array, start: number): number {
  for (let i = start; i < buffer.length; i += 1) {
    if (buffer[i] === 0) {
      return i;
    }
  }

  return -1;
}

/**
 * 尝试将字符串解析为 JSON 对象。
 * @param value 待解析文本。
 * @returns 解析后的对象；解析失败时返回 null。
 */
function parseJsonCandidate(value: string): JsonObject | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JsonObject;
    }
    return { value: parsed };
  } catch {
    return null;
  }
}

/**
 * 尝试将 Base64 字符串解码并解析为 JSON 对象。
 * @param value 可能为 Base64 的文本。
 * @returns 解析后的对象；解析失败时返回 null。
 */
function parseBase64JsonCandidate(value: string): JsonObject | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let normalized = trimmed.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/=_-]+$/.test(normalized)) {
    return null;
  }

  normalized = normalized.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = normalized.length % 4;
  if (remainder === 2) {
    normalized += "==";
  } else if (remainder === 3) {
    normalized += "=";
  } else if (remainder === 1) {
    return null;
  }

  try {
    const decoded = decodeBase64ToText(normalized);
    return parseJsonCandidate(decoded);
  } catch {
    return null;
  }
}

/**
 * 解析 PNG tEXt 块负载。
 * @param payload tEXt 块原始负载。
 * @returns 文本内容，解析失败返回 null。
 */
function parseTextPayload(payload: Uint8Array): string | null {
  const separator = findNullByteIndex(payload, 0);
  if (separator < 0 || separator + 1 >= payload.length) {
    return null;
  }

  return textDecoder.decode(payload.subarray(separator + 1));
}

/**
 * 解析 PNG zTXt 块负载。
 * @param payload zTXt 块原始负载。
 * @returns 解压后的文本，解析失败返回 null。
 */
async function parseZtxtPayload(payload: Uint8Array): Promise<string | null> {
  const separator = findNullByteIndex(payload, 0);
  if (separator < 0 || separator + 2 > payload.length) {
    return null;
  }

  const compressionMethod = payload[separator + 1];
  if (compressionMethod !== 0) {
    return null;
  }

  try {
    const decompressed = await inflateDeflate(payload.subarray(separator + 2));
    return textDecoder.decode(decompressed);
  } catch {
    return null;
  }
}

/**
 * 解析 PNG iTXt 块负载。
 * @param payload iTXt 块原始负载。
 * @returns 文本内容，解析失败返回 null。
 */
async function parseItxtPayload(payload: Uint8Array): Promise<string | null> {
  const keywordEnd = findNullByteIndex(payload, 0);
  if (keywordEnd < 0 || keywordEnd + 5 > payload.length) {
    return null;
  }

  const compressionFlag = payload[keywordEnd + 1];
  const compressionMethod = payload[keywordEnd + 2];
  let cursor = keywordEnd + 3;

  const languageTagEnd = findNullByteIndex(payload, cursor);
  if (languageTagEnd < 0) {
    return null;
  }
  cursor = languageTagEnd + 1;

  const translatedKeywordEnd = findNullByteIndex(payload, cursor);
  if (translatedKeywordEnd < 0) {
    return null;
  }
  cursor = translatedKeywordEnd + 1;

  const textData = payload.subarray(cursor);
  if (compressionFlag === 1) {
    if (compressionMethod !== 0) {
      return null;
    }
    try {
      const decompressed = await inflateDeflate(textData);
      return textDecoder.decode(decompressed);
    } catch {
      return null;
    }
  }

  return textDecoder.decode(textData);
}

/**
 * 从 PNG 中提取文本块内容。
 * @param bytes PNG 二进制数据。
 * @returns 提取出的所有文本内容。
 * @throws 当输入不是有效 PNG 时抛出错误。
 */
async function extractTextChunksFromPng(bytes: Uint8Array): Promise<string[]> {
  if (!bufferStartsWith(bytes, PNG_SIGNATURE)) {
    throw new Error("文件不是有效的 PNG");
  }

  const texts: string[] = [];
  let offset = PNG_SIGNATURE.length;

  while (offset + 12 <= bytes.length) {
    const chunkLength =
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3];
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;
    const crcEnd = dataEnd + 4;

    if (chunkLength < 0 || crcEnd > bytes.length) {
      break;
    }

    const payload = bytes.subarray(dataStart, dataEnd);
    let parsed: string | null = null;

    if (type === "tEXt") {
      parsed = parseTextPayload(payload);
    } else if (type === "zTXt") {
      parsed = await parseZtxtPayload(payload);
    } else if (type === "iTXt") {
      parsed = await parseItxtPayload(payload);
    }

    if (parsed) {
      texts.push(parsed);
    }

    offset = crcEnd;
    if (type === "IEND") {
      break;
    }
  }

  return texts;
}

/**
 * 从 PNG 中提取并解析角色卡 JSON。
 * @param bytes PNG 二进制数据。
 * @returns 解析后的 JSON 对象。
 * @throws 当无法解析出 JSON 时抛出错误。
 */
async function parseJsonFromPng(bytes: Uint8Array): Promise<JsonObject> {
  const textChunks = await extractTextChunksFromPng(bytes);
  const keywordPriority = ["chara", "ccv3", "character", "card"];

  const prioritized = [...textChunks].sort((a, b) => {
    const ai = keywordPriority.findIndex((k) => a.toLowerCase().includes(k));
    const bi = keywordPriority.findIndex((k) => b.toLowerCase().includes(k));
    const aa = ai < 0 ? Number.MAX_SAFE_INTEGER : ai;
    const bb = bi < 0 ? Number.MAX_SAFE_INTEGER : bi;
    return aa - bb;
  });

  for (const value of prioritized) {
    const direct = parseJsonCandidate(value);
    if (direct) {
      return direct;
    }

    const decoded = parseBase64JsonCandidate(value);
    if (decoded) {
      return decoded;
    }
  }

  throw new Error("未在 PNG 中找到可解析的角色卡 JSON");
}

/**
 * 从文本内容解析 JSON。
 * @param text 文件文本内容。
 * @returns 解析后的 JSON 对象。
 * @throws 当文本不是有效 JSON 时抛出错误。
 */
function parseJsonFromText(text: string): JsonObject {
  const direct = parseJsonCandidate(text);
  if (direct) {
    return direct;
  }

  const decoded = parseBase64JsonCandidate(text);
  if (decoded) {
    return decoded;
  }

  throw new Error("文件内容不是有效 JSON");
}

/**
 * 自动识别输入类型并解析 JSON。
 * @param input 文件路径或二进制数据。
 * @returns 解析后的 JSON 对象。
 */
async function parseAnyJson(input: FileInput): Promise<JsonObject> {
  const bytes = await readInputBytes(input);
  if (bufferStartsWith(bytes, PNG_SIGNATURE)) {
    return await parseJsonFromPng(bytes);
  }

  return parseJsonFromText(textDecoder.decode(bytes));
}

/**
 * 将未知值安全转换为对象。
 * @param value 待转换值。
 * @returns 对象或 null。
 */
function asObject(value: unknown): JsonObject | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return null;
}

/**
 * 将未知值安全转换为字符串。
 * @param value 待转换值。
 * @returns 字符串值，非字符串时返回空串。
 */
function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * 将未知值安全转换为字符串数组。
 * @param value 待转换值。
 * @returns 字符串数组。
 */
function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * 将未知值安全转换为有限数字。
 * @param value 待转换值。
 * @returns 数字或 undefined。
 */
function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * 将未知值安全转换为布尔值。
 * @param value 待转换值。
 * @returns 布尔值或 undefined。
 */
function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/**
 * 判断值是否为非数组 JSON 对象。
 * @param value 待判断值。
 * @returns 是否为 JSON 对象。
 */
function isJsonObjectValue(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * 将路径输入规范化为路径片段数组。
 * @param path 路径字符串或路径片段数组。
 * @returns 路径片段数组。
 */
function parsePath(path: PathInput): PathSegment[] {
  if (Array.isArray(path)) {
    return path;
  }

  const normalized = path.replace(/\[(\d+)\]/g, ".$1");
  return normalized
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
}

/**
 * 按路径安全读取任意对象中的值。
 * @typeParam T 返回值类型。
 * @param source 数据源对象。
 * @param path 路径表达式，支持 a.b[0].c 形式。
 * @param defaultValue 未命中或值为 undefined 时的默认值。
 * @returns 读取到的值或默认值。
 */
export function getValueByPath<T = unknown>(
  source: unknown,
  path: PathInput,
  defaultValue?: T
): T | undefined {
  const segments = parsePath(path);
  if (segments.length === 0) {
    if (source === undefined) {
      return defaultValue;
    }
    return source as T;
  }

  let current: unknown = source;
  for (const segment of segments) {
    if (typeof segment === "number") {
      if (!Array.isArray(current) || segment < 0 || segment >= current.length) {
        return defaultValue;
      }
      current = current[segment];
      continue;
    }

    if (!isJsonObjectValue(current) || !(segment in current)) {
      return defaultValue;
    }
    current = current[segment];
  }

  if (current === undefined) {
    return defaultValue;
  }
  return current as T;
}

/**
 * 从对象中按优先级选择第一个非空字符串字段。
 * @param source 源对象。
 * @param keys 候选字段名列表。
 * @returns 命中的字符串，未命中时返回空串。
 */
function pickString(source: JsonObject | null, keys: string[]): string {
  if (!source) {
    return "";
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return "";
}

/**
 * 从已解析数据中提取世界书原始对象。
 * @param parsed 已解析 JSON 对象。
 * @returns 世界书对象；未命中时返回原对象。
 */
function extractWorldRawFromParsed(parsed: JsonObject): JsonObject {
  const directKeys = ["character_book", "worldbook", "world_info", "lorebook"];
  for (const key of directKeys) {
    const candidate = asObject(parsed[key]);
    if (candidate) {
      return candidate;
    }
  }

  const data = asObject(parsed.data);
  if (data) {
    for (const key of directKeys) {
      const candidate = asObject(data[key]);
      if (candidate) {
        return candidate;
      }
    }
  }

  const extensions = data ? asObject(data.extensions) : asObject(parsed.extensions);
  if (extensions) {
    const extensionKeys = ["world", "worldbook", "character_book", "lorebook"];
    for (const key of extensionKeys) {
      const candidate = asObject(extensions[key]);
      if (candidate) {
        return candidate;
      }
    }
  }

  return parsed;
}

/**
 * 标准化单条世界书条目。
 * @param entry 世界书条目原始对象。
 * @returns 标准化条目数据。
 */
function normalizeWorldEntry(entry: JsonObject): WorldEntryInfo {
  return {
    raw: entry,
    uid: typeof entry.uid === "number" || typeof entry.uid === "string" ? entry.uid : undefined,
    keys: asStringArray(entry.keys),
    secondaryKeys: asStringArray(entry.secondary_keys),
    comment: asString(entry.comment),
    content: asString(entry.content),
    enabled: entry.enabled !== false,
    order: asNumber(entry.order),
    position:
      typeof entry.position === "number" || typeof entry.position === "string"
        ? entry.position
        : undefined,
    probability: asNumber(entry.probability),
    depth: asNumber(entry.depth),
  };
}

/**
 * 基于世界书原始数据构建结构化信息。
 * @param raw 世界书原始对象。
 * @returns 结构化世界书信息。
 */
function createWorldInfo(raw: JsonObject): WorldInfo {
  const entriesRaw = Array.isArray(raw.entries) ? raw.entries : [];
  const entries = entriesRaw
    .map((entry) => asObject(entry))
    .filter((entry): entry is JsonObject => entry !== null)
    .map((entry) => normalizeWorldEntry(entry));

  return {
    raw,
    name: pickString(raw, ["name", "title", "world_name"]),
    entries,
    entryCount: entries.length,
  };
}

/**
 * 基于角色原始数据构建结构化角色信息。
 * @param raw 角色原始对象。
 * @returns 结构化角色信息。
 */
function createCharacterInfo(raw: JsonObject): CharacterInfo {
  const data = asObject(raw.data);
  const worldRaw = extractWorldRawFromParsed(raw);
  const worldEntries = Array.isArray(worldRaw.entries) ? worldRaw.entries : [];
  const worldInfo = worldEntries.length > 0 ? createWorldInfo(worldRaw) : null;
  const tagsFromData = asStringArray(data?.tags);
  const tags = tagsFromData.length > 0 ? tagsFromData : asStringArray(raw.tags);

  return {
    raw,
    data,
    name: pickString(data, ["name"]) || pickString(raw, ["name"]),
    description: pickString(data, ["description"]) || pickString(raw, ["description"]),
    personality: pickString(data, ["personality"]) || pickString(raw, ["personality"]),
    scenario: pickString(data, ["scenario"]) || pickString(raw, ["scenario"]),
    firstMessage: pickString(data, ["first_mes", "firstMessage"]) || pickString(raw, ["first_mes", "firstMessage"]),
    exampleMessages: pickString(data, ["mes_example", "example_messages"]) || pickString(raw, ["mes_example", "example_messages"]),
    tags,
    creatorComment:
      pickString(data, ["creator_notes", "creatorcomment"]) || pickString(raw, ["creator_notes", "creatorcomment"]),
    avatar: pickString(data, ["avatar"]) || pickString(raw, ["avatar"]),
    spec: pickString(raw, ["spec"]),
    specVersion: pickString(raw, ["spec_version"]),
    worldInfo,
  };
}

/**
 * 根据预设来源解析对应模型名称。
 * @param raw 预设原始对象。
 * @param source 聊天补全来源。
 * @returns 解析出的模型名称。
 */
function resolvePresetModel(raw: JsonObject, source: string): string {
  const bySource: Record<string, string> = {
    openai: "openai_model",
    claude: "claude_model",
    windowai: "windowai_model",
    openrouter: "openrouter_model",
    ai21: "ai21_model",
    mistralai: "mistralai_model",
    cohere: "cohere_model",
    perplexity: "perplexity_model",
    groq: "groq_model",
    zerooneai: "zerooneai_model",
    blockentropy: "blockentropy_model",
    custom: "custom_model",
    google: "google_model",
  };

  const modelKey = bySource[source];
  if (modelKey && typeof raw[modelKey] === "string") {
    return asString(raw[modelKey]);
  }

  const fallbackKeys = Object.values(bySource);
  for (const key of fallbackKeys) {
    if (typeof raw[key] === "string" && asString(raw[key]).length > 0) {
      return asString(raw[key]);
    }
  }

  return "";
}

/**
 * 基于预设原始数据构建结构化预设信息。
 * @param raw 预设原始对象。
 * @returns 结构化预设信息。
 */
function createPresetsInfo(raw: JsonObject): PresetsInfo {
  const source = pickString(raw, ["chat_completion_source"]);
  return {
    raw,
    source,
    model: resolvePresetModel(raw, source),
    temperature: asNumber(raw.temperature),
    topP: asNumber(raw.top_p),
    topK: asNumber(raw.top_k),
    minP: asNumber(raw.min_p),
    maxContext: asNumber(raw.openai_max_context),
    maxTokens: asNumber(raw.openai_max_tokens),
    seed: asNumber(raw.seed),
    stream: asBoolean(raw.stream_openai),
  };
}

/**
 * 解析角色卡文件并返回结构化角色信息。
 * @param input 文件路径或二进制内容。
 * @returns 角色信息。
 */
export async function getCharacterInfo(input: FileInput): Promise<CharacterInfo> {
  const raw = await parseAnyJson(input);
  return createCharacterInfo(raw);
}

/**
 * 解析世界书文件并返回结构化世界书信息。
 * @param input 文件路径或二进制内容。
 * @returns 世界书信息。
 */
export async function getWorldInfo(input: FileInput): Promise<WorldInfo> {
  const parsed = await parseAnyJson(input);
  const worldRaw = extractWorldRawFromParsed(parsed);
  return createWorldInfo(worldRaw);
}

/**
 * 解析预设文件并返回结构化预设信息。
 * @param input 文件路径或二进制内容。
 * @returns 预设信息。
 */
export async function getPresetsInfo(input: FileInput): Promise<PresetsInfo> {
  const raw = await parseAnyJson(input);
  return createPresetsInfo(raw);
}

/**
 * 判断值是否符合 CharacterInfo 结构。
 * @param value 待判断值。
 * @returns 是否为 CharacterInfo。
 */
export function isCharacterInfo(value: unknown): value is CharacterInfo {
  if (!isJsonObjectValue(value)) {
    return false;
  }

  return (
    isJsonObjectValue(value.raw) &&
    typeof value.name === "string" &&
    Array.isArray(value.tags) &&
    "worldInfo" in value
  );
}

/**
 * 判断值是否符合 WorldInfo 结构。
 * @param value 待判断值。
 * @returns 是否为 WorldInfo。
 */
export function isWorldInfo(value: unknown): value is WorldInfo {
  if (!isJsonObjectValue(value)) {
    return false;
  }

  return isJsonObjectValue(value.raw) && typeof value.name === "string" && Array.isArray(value.entries);
}

/**
 * 判断值是否符合 PresetsInfo 结构。
 * @param value 待判断值。
 * @returns 是否为 PresetsInfo。
 */
export function isPresetsInfo(value: unknown): value is PresetsInfo {
  if (!isJsonObjectValue(value)) {
    return false;
  }

  return isJsonObjectValue(value.raw) && typeof value.source === "string" && typeof value.model === "string";
}
