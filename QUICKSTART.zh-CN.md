# Surgical Dev 快速开始

当前是四种角色、十二个 Skills 的内容包，版本 `0.3.0-content`。尚未实现自动调度、
身份认证、强制门禁或发布执行器；此次更新不会创建 Bot 或启用监控、发布权限。

1. 阅读[中文架构](ARCHITECTURE.zh-CN.md)，用[目标模板](templates/project-goal.md)提供目标、约束、预算与权限。
2. 选择 [Grok Bot](adapters/grok-bot/SETUP.md) 或 [Pi](adapters/pi/SETUP.md)。
3. 四种角色为 Product Scout、Engineer、Verifier、Operator；Engineer 自动拆分和分配工作流，不要求用户管理任务或人员。
4. 填写[项目策略](contracts/project-policy.example.yaml)，核实权限、角色寻址、检查与预算。
   示例保持 `automation_enabled: false` / `DRAFT_ONLY`，空值不代表无限授权。
5. 从小任务串行闭环开始；独立工作流可在授权容量内并行，每项有持续 Engineer 会话，集成负责人由 Engineer 兼任。
6. 各工作流先独立验收，再验证组合后的项目行为；局部 PASS 不代表项目 PR_READY。范围内自动修复，预算或权限不足才升级。

入口保持 `/skill:surgical-dev`。普通 Bug 不必经过 Scout，PR-only 不必经过 Operator，
临时 subagent 默认关闭，启用后全项目最多两个，并受总执行上限约束；不递归委派。
缺少安全并行能力就串行，不取消独立验收。技术拆分与分配不需要逐项批准；
新需求、预算、权限或超出授权的合并／发布仍需明确决策。
`prepare-release` 由 Operator 主责；准备不等于执行。超时先查原任务，不能重复发布。

本仓库包含四份 Grok 首次角色消息和十二份自包含 private-Skill 文本，均须自行配置。
它们不会自动安装。参见[验证范围](VALIDATION.md)与[待实现运行时](docs/runtime-next.md)。
