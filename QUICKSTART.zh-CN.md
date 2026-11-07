# Surgical Dev v2 快速开始

当前是四角色、十个 Skills 的内容包，版本 `0.2.0-content`。尚未实现自动调度、
身份认证、强制门禁或发布执行器；此次更新不会创建 Bot 或启用监控、发布权限。

1. 阅读[中文架构](ARCHITECTURE.zh-CN.md)和[迁移说明](MIGRATION.md)。
2. 选择 [Grok Bot](adapters/grok-bot/SETUP.md) 或 [Pi](adapters/pi/SETUP.md)。
3. 长期角色为 Product Scout、Engineer、Verifier、Operator；不创建第五个 Worker Bot。
4. 填写[项目策略](contracts/project-policy.example.yaml)，核实权限、角色寻址、检查与预算。
   示例保持 `automation_enabled: false` / `DRAFT_ONLY`，空值不代表无限授权。
5. 用一个明确 Bug 试点 Engineer → Verifier；范围内缺陷最多两轮修复复验。
6. 独立验收和交接能力验证后再考虑预览交付。生产自动化需要另外的策略与实际能力验证。

入口保持 `/skill:surgical-dev`。普通 Bug 不必经过 Scout，PR-only 不必经过 Operator，
临时 subagent 默认关闭，启用后最多两个并发且不可递归委派。
`prepare-release` 由 Operator 主责；准备不等于执行。超时先查原任务，不能重复发布。

本仓库包含四份 Grok 首次角色消息和十份自包含 private-Skill 文本，均须自行配置。
它们不会自动安装。参见[验证范围](VALIDATION.md)与[待实现运行时](docs/runtime-next.md)。
