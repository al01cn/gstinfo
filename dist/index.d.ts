export type FileInput = string | Uint8Array | ArrayBuffer;
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
/**
 * 按路径安全读取任意对象中的值。
 * @typeParam T 返回值类型。
 * @param source 数据源对象。
 * @param path 路径表达式，支持 a.b[0].c 形式。
 * @param defaultValue 未命中或值为 undefined 时的默认值。
 * @returns 读取到的值或默认值。
 */
export declare function getValueByPath<T = unknown>(source: unknown, path: PathInput, defaultValue?: T): T | undefined;
/**
 * 解析角色卡文件并返回结构化角色信息。
 * @param input 文件路径或二进制内容。
 * @returns 角色信息。
 */
export declare function getCharacterInfo(input: FileInput): Promise<CharacterInfo>;
/**
 * 解析世界书文件并返回结构化世界书信息。
 * @param input 文件路径或二进制内容。
 * @returns 世界书信息。
 */
export declare function getWorldInfo(input: FileInput): Promise<WorldInfo>;
/**
 * 解析预设文件并返回结构化预设信息。
 * @param input 文件路径或二进制内容。
 * @returns 预设信息。
 */
export declare function getPresetsInfo(input: FileInput): Promise<PresetsInfo>;
/**
 * 判断值是否符合 CharacterInfo 结构。
 * @param value 待判断值。
 * @returns 是否为 CharacterInfo。
 */
export declare function isCharacterInfo(value: unknown): value is CharacterInfo;
/**
 * 判断值是否符合 WorldInfo 结构。
 * @param value 待判断值。
 * @returns 是否为 WorldInfo。
 */
export declare function isWorldInfo(value: unknown): value is WorldInfo;
/**
 * 判断值是否符合 PresetsInfo 结构。
 * @param value 待判断值。
 * @returns 是否为 PresetsInfo。
 */
export declare function isPresetsInfo(value: unknown): value is PresetsInfo;
