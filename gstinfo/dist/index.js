import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const textDecoder = new TextDecoder("utf-8");
function asUint8Array(input) {
    if (typeof input === "string") {
        throw new Error("不支持将字符串直接转换为二进制，请先读取文件");
    }
    if (input instanceof Uint8Array) {
        return input;
    }
    return new Uint8Array(input);
}
async function readInputBytes(input) {
    if (typeof input === "string") {
        const buffer = await readFile(input);
        return new Uint8Array(buffer);
    }
    return asUint8Array(input);
}
function bufferStartsWith(buffer, signature) {
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
function findNullByteIndex(buffer, start) {
    for (let i = start; i < buffer.length; i += 1) {
        if (buffer[i] === 0) {
            return i;
        }
    }
    return -1;
}
function parseJsonCandidate(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed;
        }
        return { value: parsed };
    }
    catch {
        return null;
    }
}
function parseBase64JsonCandidate(value) {
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
    }
    else if (remainder === 3) {
        normalized += "=";
    }
    else if (remainder === 1) {
        return null;
    }
    try {
        const decoded = Buffer.from(normalized, "base64").toString("utf-8");
        return parseJsonCandidate(decoded);
    }
    catch {
        return null;
    }
}
function parseTextPayload(payload) {
    const separator = findNullByteIndex(payload, 0);
    if (separator < 0 || separator + 1 >= payload.length) {
        return null;
    }
    return textDecoder.decode(payload.subarray(separator + 1));
}
function parseZtxtPayload(payload) {
    const separator = findNullByteIndex(payload, 0);
    if (separator < 0 || separator + 2 > payload.length) {
        return null;
    }
    const compressionMethod = payload[separator + 1];
    if (compressionMethod !== 0) {
        return null;
    }
    try {
        const decompressed = inflateSync(payload.subarray(separator + 2));
        return textDecoder.decode(decompressed);
    }
    catch {
        return null;
    }
}
function parseItxtPayload(payload) {
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
            return textDecoder.decode(inflateSync(textData));
        }
        catch {
            return null;
        }
    }
    return textDecoder.decode(textData);
}
function extractTextChunksFromPng(bytes) {
    if (!bufferStartsWith(bytes, PNG_SIGNATURE)) {
        throw new Error("文件不是有效的 PNG");
    }
    const texts = [];
    let offset = PNG_SIGNATURE.length;
    while (offset + 12 <= bytes.length) {
        const chunkLength = (bytes[offset] << 24) |
            (bytes[offset + 1] << 16) |
            (bytes[offset + 2] << 8) |
            bytes[offset + 3];
        const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
        const dataStart = offset + 8;
        const dataEnd = dataStart + chunkLength;
        const crcEnd = dataEnd + 4;
        if (chunkLength < 0 || crcEnd > bytes.length) {
            break;
        }
        const payload = bytes.subarray(dataStart, dataEnd);
        let parsed = null;
        if (type === "tEXt") {
            parsed = parseTextPayload(payload);
        }
        else if (type === "zTXt") {
            parsed = parseZtxtPayload(payload);
        }
        else if (type === "iTXt") {
            parsed = parseItxtPayload(payload);
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
function parseJsonFromPng(bytes) {
    const textChunks = extractTextChunksFromPng(bytes);
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
function parseJsonFromText(text) {
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
async function parseAnyJson(input) {
    const bytes = await readInputBytes(input);
    if (bufferStartsWith(bytes, PNG_SIGNATURE)) {
        return parseJsonFromPng(bytes);
    }
    return parseJsonFromText(textDecoder.decode(bytes));
}
function asObject(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value;
    }
    return null;
}
function asString(value) {
    return typeof value === "string" ? value : "";
}
function asStringArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item) => typeof item === "string");
}
function asNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function asBoolean(value) {
    return typeof value === "boolean" ? value : undefined;
}
function isJsonObjectValue(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function parsePath(path) {
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
export function getValueByPath(source, path, defaultValue) {
    const segments = parsePath(path);
    if (segments.length === 0) {
        if (source === undefined) {
            return defaultValue;
        }
        return source;
    }
    let current = source;
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
    return current;
}
function pickString(source, keys) {
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
function extractWorldRawFromParsed(parsed) {
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
function normalizeWorldEntry(entry) {
    return {
        raw: entry,
        uid: typeof entry.uid === "number" || typeof entry.uid === "string" ? entry.uid : undefined,
        keys: asStringArray(entry.keys),
        secondaryKeys: asStringArray(entry.secondary_keys),
        comment: asString(entry.comment),
        content: asString(entry.content),
        enabled: entry.enabled !== false,
        order: asNumber(entry.order),
        position: typeof entry.position === "number" || typeof entry.position === "string"
            ? entry.position
            : undefined,
        probability: asNumber(entry.probability),
        depth: asNumber(entry.depth),
    };
}
function createWorldInfo(raw) {
    const entriesRaw = Array.isArray(raw.entries) ? raw.entries : [];
    const entries = entriesRaw
        .map((entry) => asObject(entry))
        .filter((entry) => entry !== null)
        .map((entry) => normalizeWorldEntry(entry));
    return {
        raw,
        name: pickString(raw, ["name", "title", "world_name"]),
        entries,
        entryCount: entries.length,
    };
}
function createCharacterInfo(raw) {
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
        creatorComment: pickString(data, ["creator_notes", "creatorcomment"]) || pickString(raw, ["creator_notes", "creatorcomment"]),
        avatar: pickString(data, ["avatar"]) || pickString(raw, ["avatar"]),
        spec: pickString(raw, ["spec"]),
        specVersion: pickString(raw, ["spec_version"]),
        worldInfo,
    };
}
function resolvePresetModel(raw, source) {
    const bySource = {
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
function createPresetsInfo(raw) {
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
export async function getCharacterInfo(input) {
    const raw = await parseAnyJson(input);
    return createCharacterInfo(raw);
}
export async function getWorldInfo(input) {
    const parsed = await parseAnyJson(input);
    const worldRaw = extractWorldRawFromParsed(parsed);
    return createWorldInfo(worldRaw);
}
export async function getPresetsInfo(input) {
    const raw = await parseAnyJson(input);
    return createPresetsInfo(raw);
}
export function isCharacterInfo(value) {
    if (!isJsonObjectValue(value)) {
        return false;
    }
    return (isJsonObjectValue(value.raw) &&
        typeof value.name === "string" &&
        Array.isArray(value.tags) &&
        "worldInfo" in value);
}
export function isWorldInfo(value) {
    if (!isJsonObjectValue(value)) {
        return false;
    }
    return isJsonObjectValue(value.raw) && typeof value.name === "string" && Array.isArray(value.entries);
}
export function isPresetsInfo(value) {
    if (!isJsonObjectValue(value)) {
        return false;
    }
    return isJsonObjectValue(value.raw) && typeof value.source === "string" && typeof value.model === "string";
}
