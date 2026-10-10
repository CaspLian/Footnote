#!/usr/bin/env python3
"""Validate the canonical Agent Skill metadata and local resources."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Optional
from urllib.parse import unquote, urlsplit


NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
FRONTMATTER_FIELD = re.compile(r"^([A-Za-z0-9_-]+):(?:[ \t]*(.*))?$")
INLINE_LINK = re.compile(
    r"!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))"
    r"(?:\s+(?:\"[^\"]*\"|'[^']*'|\([^)]*\)))?\s*\)"
)
REFERENCE_DEFINITION = re.compile(
    r"^ {0,3}\[[^\]]+\]:\s*(?:<([^>]+)>|(\S+))", re.MULTILINE
)
INLINE_CODE = re.compile(r"(?<!`)`([^`\n]+)`(?!`)")
FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})")
HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
WINDOWS_ABSOLUTE = re.compile(r"^[A-Za-z]:[\\/]")
RESOURCE_PREFIXES = ("references/", "scripts/", "assets/", "./", "../")


class InputError(ValueError):
    """Raised for invalid user input."""


class CliParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        self.exit(2, f"error: {message}\n")


def strip_yaml_comment(value: str) -> str:
    quote: Optional[str] = None
    escaped = False
    index = 0
    while index < len(value):
        character = value[index]
        if quote == '"':
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
        elif quote == "'":
            if character == "'" and index + 1 < len(value) and value[index + 1] == "'":
                index += 1
            elif character == quote:
                quote = None
        elif character in ('"', "'"):
            quote = character
        elif character == "#" and (index == 0 or value[index - 1].isspace()):
            return value[:index].rstrip()
        index += 1
    return value


def rendered_markdown(text: str) -> str:
    """Mask comments and fenced examples while preserving source line numbers."""
    text = HTML_COMMENT.sub(lambda match: "\n" * match.group(0).count("\n"), text)
    rendered: list[str] = []
    fence_marker: Optional[str] = None
    for line in text.splitlines():
        fence_match = FENCE.match(line)
        if fence_match:
            marker = fence_match.group(1)
            if fence_marker is None:
                fence_marker = marker
            elif marker[0] == fence_marker[0] and len(marker) >= len(fence_marker):
                fence_marker = None
            rendered.append("")
            continue
        rendered.append("" if fence_marker is not None else line)
    return "\n".join(rendered)


def decode_scalar(value: str) -> str:
    value = strip_yaml_comment(value).strip()
    if value.startswith('"'):
        try:
            decoded = json.loads(value)
        except json.JSONDecodeError as exc:
            raise ValueError(f"invalid quoted scalar: {exc.msg}") from None
        if not isinstance(decoded, str):
            raise ValueError("frontmatter values must be strings")
        return decoded
    if value.startswith("'"):
        if len(value) < 2 or not value.endswith("'"):
            raise ValueError("unterminated quoted scalar")
        return value[1:-1].replace("''", "'")
    return value


def parse_frontmatter(text: str) -> tuple[dict[str, str], list[str]]:
    lines = text.splitlines()
    errors: list[str] = []
    if not lines or lines[0].strip() != "---":
        return {}, ["SKILL.md must begin with YAML frontmatter"]

    try:
        closing = next(index for index in range(1, len(lines)) if lines[index].strip() == "---")
    except StopIteration:
        return {}, ["frontmatter is not closed with ---"]

    fields: dict[str, str] = {}
    current_key: Optional[str] = None
    block_style = False
    for line_number, line in enumerate(lines[1:closing], 2):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if line[:1].isspace() and current_key is not None:
            continuation = line.strip()
            if continuation:
                separator = "\n" if block_style else " "
                fields[current_key] = fields[current_key] + separator + continuation
            continue

        match = FRONTMATTER_FIELD.match(line)
        if not match:
            errors.append(f"invalid frontmatter line {line_number}")
            current_key = None
            block_style = False
            continue
        key, raw_value = match.group(1), match.group(2) or ""
        if key in fields:
            errors.append(f"duplicate frontmatter field: {key}")
            current_key = None
            block_style = False
            continue
        cleaned_value = strip_yaml_comment(raw_value).strip()
        block_style = cleaned_value in ("|", ">")
        try:
            fields[key] = "" if block_style else decode_scalar(raw_value)
        except ValueError as exc:
            errors.append(f"invalid {key!r} value: {exc}")
            fields[key] = ""
        current_key = key

    return fields, errors


def markdown_destinations(text: str) -> list[str]:
    destinations = [match.group(1) or match.group(2) for match in INLINE_LINK.finditer(text)]
    destinations.extend(
        match.group(1) or match.group(2) for match in REFERENCE_DEFINITION.finditer(text)
    )
    return destinations


def local_target(destination: str) -> Optional[str]:
    destination = destination.strip()
    if not destination or destination.startswith(("#", "//")):
        return None
    try:
        scheme = urlsplit(destination).scheme
    except ValueError as exc:
        raise ValueError(f"{destination!r}: {exc}") from None
    if not WINDOWS_ABSOLUTE.match(destination) and scheme:
        return None
    path_part = destination.split("#", 1)[0].split("?", 1)[0]
    return unquote(path_part) or None


def referenced_resources(text: str) -> tuple[list[str], list[str]]:
    text = rendered_markdown(text)
    resources: set[str] = set()
    errors: list[str] = []
    for destination in markdown_destinations(text):
        try:
            target = local_target(destination)
        except ValueError as exc:
            errors.append(f"invalid Markdown destination: {exc}")
            continue
        if target is not None:
            resources.add(target)
    for match in INLINE_CODE.finditer(text):
        candidate = match.group(1).strip().replace("\\", "/")
        if candidate.startswith(RESOURCE_PREFIXES):
            resources.add(candidate)
    return sorted(resources), errors


def validate_resources(text: str, skill_file: Path) -> list[str]:
    resources, errors = referenced_resources(text)
    root = skill_file.parent.resolve()
    for resource in resources:
        resource_path = Path(resource)
        candidate = resource_path if resource_path.is_absolute() else root / resource_path
        try:
            resolved = candidate.resolve()
            resolved.relative_to(root)
        except (OSError, ValueError):
            errors.append(f"local resource escapes skill directory: {resource}")
            continue
        try:
            if not resolved.is_file():
                errors.append(f"missing local resource: {resource}")
        except OSError:
            errors.append(f"unreadable local resource: {resource}")
    return errors


def read_skill(path: Path) -> str:
    try:
        if not path.is_file():
            raise InputError(f"file not found or not a regular file: {path}")
        return path.read_text(encoding="utf-8-sig")
    except InputError:
        raise
    except (OSError, UnicodeError) as exc:
        raise InputError(f"cannot read {path}: {exc}") from None


def build_parser() -> argparse.ArgumentParser:
    default_skill = Path(__file__).resolve().parent.parent / "SKILL.md"
    parser = CliParser(
        description="Validate canonical SKILL.md frontmatter, naming, size, and local resources."
    )
    parser.add_argument(
        "--file",
        default=str(default_skill),
        help="canonical SKILL.md path (defaults to the skill containing this script)",
    )
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    skill_file = Path(args.file)
    try:
        text = read_skill(skill_file)
    except InputError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    fields, errors = parse_frontmatter(text)
    name = fields.get("name", "").strip()
    description = fields.get("description", "").strip()
    if not name:
        errors.append("frontmatter field 'name' is required and must be non-empty")
    elif len(name) > 64 or not NAME_PATTERN.fullmatch(name):
        errors.append("frontmatter 'name' must be at most 64 lowercase letters, digits, or hyphen-separated words")
    elif name != skill_file.parent.name:
        errors.append(f"frontmatter name {name!r} does not match parent directory {skill_file.parent.name!r}")
    if not description:
        errors.append("frontmatter field 'description' is required and must be non-empty")
    elif len(description) > 1024:
        errors.append("frontmatter 'description' must be at most 1024 characters")

    if "compatibility" in fields:
        compatibility = fields["compatibility"].strip()
        if not compatibility:
            errors.append("frontmatter 'compatibility' must be non-empty when provided")
        elif len(compatibility) > 500:
            errors.append("frontmatter 'compatibility' must be at most 500 characters")

    errors.extend(validate_resources(text, skill_file))
    line_count = len(text.splitlines())
    warnings = []
    if line_count >= 500:
        warnings.append(f"SKILL.md has {line_count} lines; fewer than 500 is recommended")

    if errors:
        print("Skill validation failed.")
        for error in errors:
            print(f"- {error}")
        for warning in warnings:
            print(f"warning: {warning}")
        return 1

    print("Skill validation passed.")
    for warning in warnings:
        print(f"warning: {warning}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
