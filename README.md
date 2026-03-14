# gstinfo - Get SillyTavern Info

中文 | English

## 中文说明

### 项目简介

`gstinfo` 是一个用于解析 SillyTavern 数据文件的 TypeScript 库，支持以下输入：
- 角色卡（PNG / JSON）
- 世界书（JSON，或从角色卡中自动提取绑定世界书）
- 预设（JSON）

### 仓库地址

- Gitee: https://gitee.com/al01/gstinfo
- GitHub: https://github.com/al01cn/gstinfo

### 项目结构

```text
gstinfo/
  dist/
    index.js
    index.global.js
    index.d.ts
  src/
    index.ts
  package.json
  tsconfig.json
```

### 安装

如果你从包管理器使用：

```bash
npm install gstinfo
yarn add gstinfo
pnpm add gstinfo
bun add gstinfo
```

如果你在当前仓库本地开发：

```bash
cd gstinfo
bun install
```

### 构建与类型检查

```bash
cd gstinfo
bun run build
bunx tsc --noEmit
```

### 使用方式

#### 输入规则（统一 API）

- `getCharacterInfo(input)`
- `getWorldInfo(input)`
- `getPresetsInfo(input)`

三个函数在 Node 与浏览器下保持同一签名，均为 `input` 单参数。

- Node.js：支持 `文件路径(string)`、`Buffer(Uint8Array)`、`Uint8Array`、`ArrayBuffer`
- 浏览器：支持 `File/Blob`、`Uint8Array`、`ArrayBuffer`

#### Node.js（工程化）

```ts
import { getCharacterInfo, getWorldInfo, getPresetsInfo } from "gstinfo";

const character = await getCharacterInfo("path/to/character.png");
const world = await getWorldInfo("path/to/world.json");
const preset = await getPresetsInfo("path/to/preset.json");
```

```ts
import { readFile } from "node:fs/promises";
import { getCharacterInfo } from "gstinfo";

const buf = await readFile("path/to/character.png");
const character = await getCharacterInfo(buf);
```

#### 浏览器（工程化）

```ts
import { getCharacterInfo } from "gstinfo";

const input = document.querySelector<HTMLInputElement>("#fileInput");
const file = input?.files?.[0];
if (file) {
  const character = await getCharacterInfo(file);
  console.log(character);
}
```

#### 浏览器（CDN 引入）

```html
<script src="https://cdn.jsdelivr.net/npm/gstinfo@0.0.2/dist/index.global.js"></script>
<script>
  const input = document.getElementById("fileInput");
  input.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const character = await GSTInfo.getCharacterInfo(file);
    console.log(character);
  });
</script>
```

### 快速开始（通用）

```ts
import {
  getCharacterInfo,
  getWorldInfo,
  getPresetsInfo,
  getValueByPath,
  isCharacterInfo,
  isWorldInfo,
  isPresetsInfo,
} from "./src/index.ts";

const character = await getCharacterInfo("path/to/character.png");
const world = await getWorldInfo("path/to/character.png");
const preset = await getPresetsInfo("path/to/preset.json");

const firstEntryContent = getValueByPath<string>(
  character,
  "worldInfo.entries[0].content",
  ""
);

const isValid =
  isCharacterInfo(character) &&
  isWorldInfo(world) &&
  isPresetsInfo(preset);
```

### 核心 API

- `getCharacterInfo(file)`：返回结构化角色信息 `CharacterInfo`
- `getWorldInfo(file)`：返回结构化世界书信息 `WorldInfo`
- `getPresetsInfo(file)`：返回结构化预设信息 `PresetsInfo`
- `getValueByPath(obj, path, defaultValue)`：按路径安全读取任意字段
- `isCharacterInfo / isWorldInfo / isPresetsInfo`：模型类型守卫

### 数据模型

- `CharacterInfo`：角色基础字段、标签、世界书聚合、原始数据
- `WorldInfo`：世界书名称、条目列表、条目数量、原始数据
- `WorldEntryInfo`：世界书条目标准化字段（关键词、内容、开关等）
- `PresetsInfo`：预设来源、模型、采样参数、上下文参数、原始数据

### 技术栈

- TypeScript
- Bun
- Node.js 内置模块（`fs/promises`、`zlib`）

## English

### Overview

`gstinfo` is a TypeScript library for parsing SillyTavern-related data files:
- Character cards (PNG / JSON)
- World books (JSON, or auto-extracted from character cards)
- Presets (JSON)

### Repository

- Gitee: https://gitee.com/al01/gstinfo
- GitHub: https://github.com/al01cn/gstinfo

### Project Structure

```text
gstinfo/
  dist/
    index.js
    index.global.js
    index.d.ts
  src/
    index.ts
  package.json
  tsconfig.json
```

### Installation

From a package manager:

```bash
npm install gstinfo
yarn add gstinfo
pnpm add gstinfo
bun add gstinfo
```

For local development in this repository:

```bash
cd gstinfo
bun install
```

### Build and Type Check

```bash
cd gstinfo
bun run build
bunx tsc --noEmit
```

### Usage

#### Unified Input API

- `getCharacterInfo(input)`
- `getWorldInfo(input)`
- `getPresetsInfo(input)`

The three functions share the same one-argument signature across Node and browsers.

- Node.js: `path(string)`, `Buffer(Uint8Array)`, `Uint8Array`, `ArrayBuffer`
- Browser: `File/Blob`, `Uint8Array`, `ArrayBuffer`

#### Node.js (Bundler/Runtime)

```ts
import { getCharacterInfo, getWorldInfo, getPresetsInfo } from "gstinfo";

const character = await getCharacterInfo("path/to/character.png");
const world = await getWorldInfo("path/to/world.json");
const preset = await getPresetsInfo("path/to/preset.json");
```

```ts
import { readFile } from "node:fs/promises";
import { getCharacterInfo } from "gstinfo";

const buf = await readFile("path/to/character.png");
const character = await getCharacterInfo(buf);
```

#### Browser (Bundler)

```ts
import { getCharacterInfo } from "gstinfo";

const input = document.querySelector<HTMLInputElement>("#fileInput");
const file = input?.files?.[0];
if (file) {
  const character = await getCharacterInfo(file);
  console.log(character);
}
```

#### Browser (CDN)

```html
<script src="https://cdn.jsdelivr.net/npm/gstinfo@0.0.2/dist/index.global.js"></script>
<script>
  const input = document.getElementById("fileInput");
  input.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const character = await GSTInfo.getCharacterInfo(file);
    console.log(character);
  });
</script>
```

### Quick Start (Generic)

```ts
import {
  getCharacterInfo,
  getWorldInfo,
  getPresetsInfo,
  getValueByPath,
  isCharacterInfo,
  isWorldInfo,
  isPresetsInfo,
} from "./src/index.ts";

const character = await getCharacterInfo("path/to/character.png");
const world = await getWorldInfo("path/to/character.png");
const preset = await getPresetsInfo("path/to/preset.json");

const firstEntryContent = getValueByPath<string>(
  character,
  "worldInfo.entries[0].content",
  ""
);

const isValid =
  isCharacterInfo(character) &&
  isWorldInfo(world) &&
  isPresetsInfo(preset);
```

### Core API

- `getCharacterInfo(file)`: returns structured character info (`CharacterInfo`)
- `getWorldInfo(file)`: returns structured world-book info (`WorldInfo`)
- `getPresetsInfo(file)`: returns structured preset info (`PresetsInfo`)
- `getValueByPath(obj, path, defaultValue)`: safely access nested values
- `isCharacterInfo / isWorldInfo / isPresetsInfo`: type guards

### Data Models

- `CharacterInfo`: core character fields, tags, world-book aggregate, raw data
- `WorldInfo`: world-book name, entries, entry count, raw data
- `WorldEntryInfo`: normalized world entry fields (keys, content, enabled, etc.)
- `PresetsInfo`: source, model, sampling/context params, raw data

### Tech Stack

- TypeScript
- Bun
- Node.js built-in modules (`fs/promises`, `zlib`)
