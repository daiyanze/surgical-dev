#!/usr/bin/env python3
"""Regenerate self-contained Grok Skill texts; no network or account operations."""
from __future__ import annotations
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'adapters' / 'grok-bot' / 'private-skills'
LINK = re.compile(r'\[([^\]]*)\]\(([^)]+)\)')

def export(skill: Path) -> None:
    text = skill.read_text(encoding='utf-8')
    references: list[Path] = []
    def convert(match: re.Match[str]) -> str:
        label, target = match.groups()
        if target.startswith('#') or re.match(r'^[a-z][a-z0-9+.-]*:', target):
            return match.group(0)
        target_file = target.split('#', 1)[0]
        path = (skill.parent / target_file).resolve()
        if not path.is_relative_to(ROOT):
            raise ValueError(f'Reference escapes package: {target}')
        if not path.is_file() or path.suffix != '.md':
            raise ValueError(f'Expected a local Markdown file: {target}')
        if path not in references:
            references.append(path)
        return f'[{label}](#reference-{references.index(path)+1})'
    body = LINK.sub(convert, text).rstrip()
    sources = [skill, *references]
    hashes = '\n'.join(f'{p.relative_to(ROOT).as_posix()} {hashlib.sha256(p.read_bytes()).hexdigest()}' for p in sources)
    body += '\n\n<!-- Generated copy. Canonical source hashes:\n' + hashes + '\n-->\n'
    for i, path in enumerate(references, 1):
        body += f'\n<a id="reference-{i}"></a>\n\n## Embedded reference {i}: {path.relative_to(ROOT).as_posix()}\n\n'
        body += path.read_text(encoding='utf-8').rstrip() + '\n'
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f'{skill.parent.name}.md').write_text(body, encoding='utf-8')

def main() -> None:
    skills = sorted((ROOT/'skills').glob('*/SKILL.md'))
    if not skills:
        raise SystemExit('No canonical Skills found.')
    for skill in skills:
        export(skill)
    print(f'Generated {len(skills)} self-contained Grok Skill texts.')

if __name__ == '__main__':
    main()
