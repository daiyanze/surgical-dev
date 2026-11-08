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

def export_roles() -> None:
    """Render role setup messages from current canonical rules, without account access."""
    boundaries = (ROOT / 'roles' / 'team-boundaries.md').read_text(encoding='utf-8').strip()
    names = {'product-scout': 'Product Scout', 'engineer': 'Engineer',
             'verifier': 'Verifier', 'operator': 'Operator'}
    for stem, name in names.items():
        role = (ROOT / 'roles' / f'{stem}.md').read_text(encoding='utf-8').strip()
        message = (
            f'# {name} — one-time role setup\n\n'
            'Copy this complete message only when you authorize configuring the Bot.\n'
            'This text is not a sandbox or permission to start a real task.\n\n---\n\n'
            f'Remember your Surgical Dev responsibility: {name}. Keep enduring rules\n'
            'separate from task-specific evidence and original action authorization.\n\n'
            f'{boundaries}\n\n{role}\n\n'
            '## Setup-only response\n\n'
            'Confirm these responsibilities and identify missing project settings,\n'
            'role addressing, runtime capacity, independent review and access. Do not\n'
            'create Bots, install tools, save Skills, launch paid work, edit repositories,\n'
            'push, merge, publish, deploy or create routines until explicitly authorized.\n'
        )
        target = ROOT / 'adapters' / 'grok-bot' / f'{stem.upper().replace("-", "_")}_SETUP.md'
        target.write_text(message, encoding='utf-8')

def main() -> None:
    skills = sorted((ROOT/'skills').glob('*/SKILL.md'))
    if not skills:
        raise SystemExit('No canonical Skills found.')
    for skill in skills:
        export(skill)
    export_roles()
    print(f'Generated {len(skills)} self-contained Grok Skill texts and four role setup messages.')

if __name__ == '__main__':
    main()
