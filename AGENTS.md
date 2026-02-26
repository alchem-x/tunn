# 开发规则速查

## 导入规范 ⭐
- 所有导入必须使用 `@/` 绝对路径 + 完整文件后缀名（包括同级目录）
- 类型导入使用 `type` 关键字（枚举除外）
- 禁止创建 `index.ts` 索引文件，直接从具体文件导入

## 文档管理
- 禁止创建额外的开发文档（GUIDE.md、NOTES.md、TODO.md、SUMMARY.md等）
- 开发规范统一维护在 `docs/dev-guide.md`
- 业务逻辑通过清晰的代码组织和必要注释说明
- 变更记录通过 Git commit 记录

## 文件命名
- 工具函数：kebab-case

## TypeScript
- 共享类型放 `@/shared/types/`
- 避免 `any`，用 `unknown` 代替
- catch 块中 error 可使用 `any`，但须进行必要检查

## 组件设计
- 单个文件代码行数不得超过 300 行

## 代码风格
- 函数命名：动词开头
- 避免魔法数字，用常量替代
- 优先让代码自解释，避免冗余注释
- 定时任务使用 `croner` 库 + cron 表达式常量

## 注释原则 ⭐
优先让代码自解释，通过清晰的命名和结构表达意图，仅在必要时添加注释。


## 错误处理
- 函数不要 catch 自己抛出的错误，让调用者决定如何处理
- 标准模式：try-loading-catch-finally

## 国际化（i18n）
- 文件名：kebab-case
- YAML key：kebab-case
- 最外层必须用文件名作 namespace
- 确保中英文两个文件 key 结构一致
