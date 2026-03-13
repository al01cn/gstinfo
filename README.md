# gstinfo - Get SillyTavern INFO

用于解析 SillyTavern 相关数据文件的 TypeScript 库，支持：
- 角色卡（PNG / JSON）
- 世界书（JSON 或角色卡内绑定世界书）
- 预设（JSON）

## 项目结构

```text
gstinfo/
  src/index.ts
  package.json
  tsconfig.json
```

## 安装依赖

```bash
npm install gstinfo

yarn add gstinfo

pnpm add gstinfo

bun add gstinfo
```

## 构建与类型检查

```bash
bun run build
bunx tsc --noEmit
```

## 核心 API

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

const firstEntry = getValueByPath<string>(character, "worldInfo.entries[0].content", "");
const ok = isCharacterInfo(character) && isWorldInfo(world) && isPresetsInfo(preset);
```

## 返回模型

- `CharacterInfo`：角色基础信息、标签、世界书模型、原始数据
- `WorldInfo`：世界书名称、条目列表、条目数量、原始数据
- `PresetsInfo`：预设来源、模型名、采样参数、上下文参数、原始数据

## 技术栈

- TypeScript
- Bun
- Node.js 内置模块（`fs/promises`、`zlib`）
