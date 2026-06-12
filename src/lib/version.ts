/**
 * ⚠️ 应用版本号 - 单一来源（Source of Truth）
 *
 * 重要：本文件**不**包含版本号字面量。版本号统一从 `package.json` 读取。
 *
 * 升级版本时，**只需要修改 `package.json` 的 `version` 字段**，
 * UI（Sidebar 底部）和任何 `import { APP_VERSION } from "@/lib/version"` 的地方会自动跟随。
 *
 * 历史背景：
 * - 之前此文件硬编码了 `export const APP_VERSION = "0.5.0"`，与 `package.json` 重复，
 *   且注释里写的"构建时通过 replace 脚本自动替换"实际**并不存在**该脚本，
 *   导致每次升级都得记得改两处，极易遗漏。
 * - 2026-06-12 v0.5.3 重构为运行时从 `package.json` 读取，加 `version.test.ts` 守住单一来源。
 *
 * 工作原理：
 * - TypeScript 开启 `resolveJsonModule: true`（见 tsconfig.json），可以直接 import JSON。
 * - Next.js 编译时会把 `package.json` 打包进 bundle，运行时从模块对象读取，永不漂移。
 *
 * ⚠️ 不要做这些事：
 * - ❌ 在此文件里硬编码 `export const APP_VERSION = "x.y.z"`
 * - ❌ 在其他地方用字面量写"v0.5.0"作为应用版本号（仅"功能引入版本"标注例外）
 * - ❌ 删除或重命名 `version.test.ts` 中的"防止硬编码"断言
 */

// 直接 import package.json（TypeScript 编译时会内联到模块对象中）
import packageJson from '../../package.json';

/**
 * 应用版本号，从 package.json 读取。
 * 类型断言为 string 是因为 tsconfig 的 moduleResolution: "bundler" 会保留字面量类型。
 */
export const APP_VERSION: string = packageJson.version;
