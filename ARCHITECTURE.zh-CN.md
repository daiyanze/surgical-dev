# Surgical Dev 架构（中文摘要）

本文是 [ARCHITECTURE.en.md](ARCHITECTURE.en.md) 的摘要，不是逐句翻译。以英文文档为准。

**状态日期：** 2026-11-12。本文只描述已实现的范围。验证证据见 [VALIDATION.md](VALIDATION.md)，Pi 操作见 [Pi setup](adapters/pi/SETUP.md)。

## 1. 目的

Surgical Dev 把开发目标变成用户确认过的验收草案，然后由一个 Worker 按计划的 Todo 实现，运行项目真实检查，经过一次全新的独立审查，并在有限次数内修复。包含两层：

- **可移植 Skills**（`skills/*/SKILL.md`）：九个指令集，任何支持 Agent Skills 的宿主都可加载。它们指导工作，本身不执行任何强制约束。
- **Pi 扩展**（`adapters/pi/`）：目前唯一已实现的运行时控制器。它负责确认、状态、预算、子进程、快照绑定和运行的终止状态。

## 2. 组件

| 组件 | 位置 | 职责 |
|---|---|---|
| Skills | `skills/` | 九个方法：入口、功能、缺陷、项目拆分、集成、有界委派、工程纪律、验收和手工学习 |
| 角色说明 | `roles/` | Worker、Verifier 和临时助手说明。Pi 运行时读取 `roles/worker.md` 与 `roles/verifier.md` |
| 记录契约 | `contracts/` | 任务、审查、项目计划的基础 JSON Schema，已禁用的策略问卷。Pi 循环不据此校验 |
| 模板 | `templates/` | Markdown 目标、计划、审查请求、审查报告和经验模板 |
| Pi 扩展 | `adapters/pi/` | 命令、目标规格、Todo DAG、检查执行、审查进程启动、状态与学习存储 |
| 打包参考 | `skills/*/references/` | 规范 Markdown 的副本，使每个安装的 Skill 自包含；由 `scripts/sync_skill_references.py` 生成，测试检查一致性 |

## 3. Pi 单工作流生命周期

1. **讨论。** `/surgical <goal>` 启动只读讨论，代理只问关键问题，并展示完整草案：目标、范围、非目标、约束和编号的验收标准（AC）。源文件不在此阶段改动。
2. **确认。** 目标规格只能由已记录的来源确认：`USER_COMMAND:/surgical confirm` 或 `USER_INPUT:confirm-and-start`（即用户本人发送 `confirm and start` 或 `确认，开始`）。运行时工具无法替代用户同意。开始运行前会核对所显示版本的摘要。
3. **计划。** Worker 阅读仓库，调用 `surgical_plan` 提交 Todo 依赖图。图必须无环，且每条原始 AC 恰好被覆盖一次。
4. **实现与检查。** 一个持续的 Worker 会话实现当前 Todo。项目检查来自 `.surgical-dev.json`，以参数数组运行，不经过 shell。只有控制器能在检查通过后标记 Todo 完成。检查失败则回到同一会话修复。
5. **审查。** 全部 Todo 完成后，控制器用临时索引捕获 Git 快照，用户的索引不变。随后在分离的 worktree 中启动一个全新的 `pi` 进程，仅提供 `read,grep,find,ls` 工具，并禁用会话、扩展、MCP、skills 和上下文文件。审查者返回逐条 AC 的 PASS、CHANGES_REQUIRED 或 BLOCKED，其中的 path:line 证据会对照快照校验。
6. **修复。** 发现的问题以追加修复 Todo 的形式交回同一 Worker，之后重新检查并再次全新审查。修复轮数受 `max_review_repair_cycles` 限制（默认 2）。
7. **停止。** 终止状态有 `PR_READY`、`BLOCKED`、`ESCALATED`、`CANCELLED` 和 `TIMED_OUT`。`PR_READY` 将最终证据绑定到快照，但它不是推送、PR、合并或发布。运行期间若 `.surgical-dev.json` 改变，运行以 `BLOCKED` 停止。

## 4. 控制器强制的不变量

- 控制器固定已确认的范围和 AC。Worker 提示禁止修改它们、删除原始 Todo、削弱检查或改动 `.surgical-dev.json`；策略摘要检查负责后一项。
- 轮次、检查和审查预算是累计的，另有运行总时限。每次启动子进程前都会检查。
- 同一仓库由仓库级锁防止并发运行。状态写入经过修订号校验，持久化失败会被报告，不会被忽略。
- Worker 与审查者在不同进程、不同会话 ID 中运行。这些 ID 只是需要核实的引用，不是经过认证的身份。
- 证据绑定版本。审查和 `PR_READY` 记录携带快照的 head 与 tree。
- 未报告的 token 或成本总计显示为 `UNKNOWN`，不记为零。

## 5. 学习（本地、仅供建议）

学习记录保存在 `<git-common-dir>/surgical-dev/learning.json`，位于源码快照之外。每个规范化的失败签名保存标签和次数；存储前脱敏，最多保留 50 条。第二次出现时，Worker 的修复反馈会附加一行 `LEARNING (advisory, not a gate)`。`/surgical lessons` 列出最近 20 条。

学习不能改变 AC、检查、范围、预算或审查结论，也不能阻止 `PR_READY`。存储错误只作为警告。没有经验生命周期、经验工具、晋升步骤，也不在克隆之间同步。手工方法见 [learn-from-failures](skills/learn-from-failures/SKILL.md) 和 [references/learning.md](references/learning.md)。

## 6. 宿主支持

| 宿主 | 本仓库实现的内容 |
|---|---|
| Pi 1.5.2+ | 完整单工作流循环。已用真实 Pi 进程和确定性本地模型验证 |
| Codex | Skills、安装指南和可选审查 agent 文件。没有控制器 |
| Claude Code | Skills 和安装指南。没有控制器，宿主需提供全新的审查者 |
| 其他 Agent Skills 宿主 | 仅有 Skill 格式；独立审查需由宿主自行安排 |

尚未评估真实模型的表现。覆盖范围与限制见 [validation](VALIDATION.md)。

## 7. 未实现

- 多 Worker 调度、并行工作流、共享资源认领和跨工作流集成验收。`decompose-project` 与 `integrate-workstreams` 只描述流程；Pi 只运行一个 Worker、一条工作流。
- 由控制器派发的临时 subagent。`delegate-bounded-task` 只是流程说明。
- 持久的崩溃恢复和自动续跑。中断的运行不会自动恢复；`/surgical stop` 可立即取消。
- 推送、草稿 PR、CI 对账、合并、tag、包发布、部署和回滚。扩展代码不执行这些动作。
- Product Scout、结果评估、事故处理，以及任何发布角色或 Skill。
- 经验的生命周期、晋升、经验工具和跨克隆同步。
- JSON 契约的跨记录校验器。Schema 只覆盖基础结构。
- 真实模型评估、长时间运行，以及 Codex 或 Claude Code 的控制器。
- 强制沙箱。审查者的只读工具列表不是操作系统沙箱。

## 8. 历史与后续工作

早期目标设计包括 Product Scout、交付与事故循环，以及多 Worker 调度，它保存在 git 历史中，提交为 `5399c29`。本文不再重复该设计。后续工作见 [runtime-next.md](docs/runtime-next.md)，资料来源及限制见 [references/sources.md](references/sources.md)。
