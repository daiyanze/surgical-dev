# Surgical Dev：拆分包快速开始

主体文件均为英文。这次提供的是已经拆分好的角色、Skills、模板与安装说明，
不是尚待拆分的长文档，也不是完整的自动编排运行时。

## 在 Grok Bot 上开始

1. 创建或选择 Engineer 和 Verifier 两个独立 Bot。
2. 分别发送 [Engineer 初始化消息](adapters/grok-bot/ENGINEER_SETUP.md) 和
   [Verifier 初始化消息](adapters/grok-bot/VERIFIER_SETUP.md) 中的完整消息。
3. 按 [Grok 设置说明](adapters/grok-bot/SETUP.md)，使用
   [private-skills](adapters/grok-bot/private-skills) 内的自包含文本保存所需私有 Skill。
   这些版本已经内嵌必要引用，不会只复制 SKILL.md 后找不到角色与模板。
4. 用 [项目配置示例](contracts/project.example.yaml) 确认实际命令、访问和授权。
5. 使用 [首次任务模板](templates/first-task.md)，先跑一个低风险任务。

这些是你手动进行的账号设置步骤。本包没有自动创建 Bot、保存 Skill 或执行任务。

## 在 Pi 中开始

解压后，在包含 surgical-dev 文件夹的目录运行：

```bash
pi install ./surgical-dev
```

然后在目标项目中新开 Pi 会话：

```text
/skill:surgical-dev <本次授权的开发任务>
```

需要项目级安装时，按 [Pi 设置说明](adapters/pi/SETUP.md) 使用 `-l`。
本地安装记录目录路径，不复制目录，所以安装后不要随意移动或删除文件夹。

## 已提供与未提供

已提供：3 个角色、6 个 Skills、共享流程、交接模板、JSON Schema、项目配置示例、
Grok 初始化消息、自包含私有 Skill 文本、Pi 内容包清单、Mermaid 和结构检查。

未提供：自动创建 Verifier 会话、强制门禁代码、`/surgeon` 命令、MCP 服务、
自动合并发布和真实 Agent 行为验证。没有独立验收者时，应报告 BLOCKED。

具体校验范围见 [VALIDATION.md](VALIDATION.md)。不要把结构测试通过等同于团队可靠性验证。
