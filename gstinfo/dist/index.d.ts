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
export declare function getValueByPath<T = unknown>(source: unknown, path: PathInput, defaultValue?: T): T | undefined;
export declare function getCharacterInfo(input: FileInput): Promise<CharacterInfo>;
export declare function getWorldInfo(input: FileInput): Promise<WorldInfo>;
export declare function getPresetsInfo(input: FileInput): Promise<PresetsInfo>;
export declare function isCharacterInfo(value: unknown): value is CharacterInfo;
export declare function isWorldInfo(value: unknown): value is WorldInfo;
export declare function isPresetsInfo(value: unknown): value is PresetsInfo;
