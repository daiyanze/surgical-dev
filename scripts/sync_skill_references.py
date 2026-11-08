#!/usr/bin/env python3
"""Bundle referenced Markdown alongside Skills for standalone installers.

Pi loads the whole package; the skills CLI installs skill directories separately.
No network calls or agent setup are performed here.
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LINK = re.compile(r"\]\((?P<path>(?:\.\./\.\./|references/)(?:roles|references|contracts|templates)/[^)#]+)(?P<fragment>#[^)]*)?\)")


def sync(check: bool) -> int:
    stale: list[str] = []
    for skill in sorted((ROOT / "skills").glob("*/SKILL.md")):
        original = skill.read_text(encoding="utf-8")
        expected_files: set[Path] = set()

        def replace(match: re.Match[str]) -> str:
            relative = match.group("path")
            source_path = (relative[6:] if relative.startswith("../../")
                           else relative[len("references/"):])
            source = (ROOT / source_path).resolve()
            if not source.is_file() or not source.is_relative_to(ROOT):
                raise ValueError(f"Missing/out-of-package reference: {skill}: {relative}")
            destination = skill.parent / "references" / source_path
            expected_files.add(destination)
            desired = source.read_bytes()
            if not destination.is_file() or destination.read_bytes() != desired:
                if check:
                    stale.append(str(destination.relative_to(ROOT)))
                else:
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    destination.write_bytes(desired)
            return f"]({destination.relative_to(skill.parent).as_posix()}{match.group('fragment') or ''})"

        updated = LINK.sub(replace, original)
        if updated != original:
            if check:
                stale.append(str(skill.relative_to(ROOT)))
            else:
                skill.write_text(updated, encoding="utf-8")
        reference_dir = skill.parent / "references"
        if reference_dir.is_dir():
            unexpected = set(reference_dir.rglob("*.md")) - expected_files
            stale.extend(str(p.relative_to(ROOT)) for p in sorted(unexpected))
    if stale:
        print("Unexpected or unsynchronized Skill files:\n" + "\n".join(stale))
        return 1
    print(f"Skill reference bundles: {'current' if check else 'synchronized'}")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Check without writing")
    args = parser.parse_args()
    raise SystemExit(sync(check=args.check))
