#!/usr/bin/env python3
"""Validate canonical, non-empty sections in a Markdown submission."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.parse import unquote, urlsplit


SECTION_ALIASES = {
    "project title": {"project title", "title"},
    "tagline": {"tagline", "one line pitch", "elevator pitch"},
    "problem": {"problem", "the problem", "problem statement"},
    "solution": {"solution", "the solution", "our solution"},
    "innovation": {"innovation", "what is innovative", "why it is different", "differentiation"},
    "architecture": {"architecture", "system architecture", "technical architecture"},
    "sponsor technology": {"sponsor technology", "sponsor integration", "sponsor usage", "technology integration"},
    "key features": {"key features", "features", "core features"},
    "setup instructions": {"setup", "setup instructions", "installation", "getting started", "local setup"},
    "demo instructions": {"demo", "demo instructions", "how to demo", "run the demo", "usage"},
    "screenshots": {"screenshots", "screenshot", "product screenshots"},
    "architecture diagram": {"architecture diagram", "system diagram", "technical diagram"},
    "technical challenges": {"technical challenges", "challenges", "challenges we faced"},
    "future roadmap": {"future roadmap", "roadmap", "future work", "what is next"},
    "impact": {"impact", "real world impact", "potential impact"},
    "team information": {"team", "team information", "about the team", "contributors"},
}
ATX_HEADING = re.compile(r"^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*$")
SETEXT_UNDERLINE = re.compile(r"^ {0,3}(=+|-+)[ \t]*$")
FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})")
HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
INLINE_CODE_SPAN = re.compile(r"(`+).*?\1")
INLINE_LINK = re.compile(
    r"!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))"
    r"(?:\s+(?:\"[^\"]*\"|'[^']*'|\([^)]*\)))?\s*\)"
)
REFERENCE_DEFINITION = re.compile(
    r"^ {0,3}\[[^\]]+\]:\s*(?:<([^>]+)>|(\S+))", re.MULTILINE
)
WINDOWS_ABSOLUTE = re.compile(r"^[A-Za-z]:[\\/]")


class InputError(ValueError):
    """Raised for invalid user input."""


class CliParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        self.exit(2, f"error: {message}\n")


@dataclass(frozen=True)
class Heading:
    level: int
    title: str
    start: int
    content_start: int


def rendered_markdown(text: str, mask_inline_code: bool = False) -> str:
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
        if fence_marker is not None:
            rendered.append("")
            continue
        rendered.append(INLINE_CODE_SPAN.sub("", line) if mask_inline_code else line)
    return "\n".join(rendered)


def markdown_headings(lines: list[str]) -> tuple[list[Heading], set[int]]:
    headings: list[Heading] = []
    heading_lines: set[int] = set()
    fence_marker: Optional[str] = None
    index = 0

    while index < len(lines):
        line = lines[index]
        fence_match = FENCE.match(line)
        if fence_match:
            marker = fence_match.group(1)
            if fence_marker is None:
                fence_marker = marker
            elif marker[0] == fence_marker[0] and len(marker) >= len(fence_marker):
                fence_marker = None
            index += 1
            continue
        if fence_marker is not None:
            index += 1
            continue

        atx = ATX_HEADING.match(line)
        if atx:
            title = re.sub(r"[ \t]+#+[ \t]*$", "", atx.group(2)).strip()
            headings.append(Heading(len(atx.group(1)), title, index, index + 1))
            heading_lines.add(index)
            index += 1
            continue

        if index + 1 < len(lines) and line.strip():
            setext = SETEXT_UNDERLINE.match(lines[index + 1])
            if setext:
                level = 1 if setext.group(1).startswith("=") else 2
                headings.append(Heading(level, line.strip(), index, index + 2))
                heading_lines.update((index, index + 1))
                index += 2
                continue
        index += 1

    return headings, heading_lines


def normalize_heading(title: str) -> str:
    title = re.sub(r"!?\[([^\]]+)\]\([^)]*\)", r"\1", title)
    title = re.sub(r"<[^>]+>", " ", title)
    title = re.sub(r"[*_~`]+", "", title)
    return " ".join(re.sub(r"[^a-z0-9]+", " ", title.lower()).split())


def section_end(headings: list[Heading], position: int, line_count: int) -> int:
    current = headings[position]
    for following in headings[position + 1 :]:
        if following.level <= current.level:
            return following.start
    return line_count


def has_meaningful_content(
    lines: list[str], start: int, end: int, heading_lines: set[int]
) -> bool:
    content = "\n".join(
        line for index, line in enumerate(lines[start:end], start) if index not in heading_lines
    )
    content = HTML_COMMENT.sub("", content)
    content = re.sub(r"(?m)^\s*(?:---+|___+|\*\*\*+)\s*$", "", content)
    return bool(content.strip())


def validate_sections(text: str) -> tuple[list[str], list[str]]:
    lines = rendered_markdown(text).splitlines()
    headings, heading_lines = markdown_headings(lines)
    normalized = [normalize_heading(heading.title) for heading in headings]
    missing: list[str] = []
    empty: list[str] = []

    for canonical, aliases in SECTION_ALIASES.items():
        positions = [index for index, title in enumerate(normalized) if title in aliases]

        if canonical == "project title":
            h1_positions = [index for index, heading in enumerate(headings) if heading.level == 1]
            if h1_positions:
                first = h1_positions[0]
                if normalized[first] not in aliases:
                    continue
                positions = sorted(set(positions + [first]))

        if not positions:
            missing.append(canonical)
            continue
        if not any(
            has_meaningful_content(
                lines,
                headings[position].content_start,
                section_end(headings, position, len(lines)),
                heading_lines,
            )
            for position in positions
        ):
            empty.append(canonical)

    return missing, empty


def markdown_destinations(text: str) -> list[str]:
    text = rendered_markdown(text, mask_inline_code=True)
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


def local_resource_issues(text: str, document: Path) -> tuple[list[str], list[str]]:
    missing: set[str] = set()
    invalid: set[str] = set()
    for destination in markdown_destinations(text):
        try:
            target = local_target(destination)
        except ValueError as exc:
            invalid.add(str(exc))
            continue
        if target is None:
            continue
        path = Path(target)
        candidate = path if path.is_absolute() else document.parent / path
        try:
            exists = candidate.exists()
        except OSError:
            exists = False
        if not exists:
            missing.add(target)
    return sorted(missing), sorted(invalid)


def read_markdown(path: Path) -> str:
    try:
        if not path.is_file():
            raise InputError(f"file not found or not a regular file: {path}")
        return path.read_text(encoding="utf-8")
    except InputError:
        raise
    except (OSError, UnicodeError) as exc:
        raise InputError(f"cannot read {path}: {exc}") from None


def build_parser() -> argparse.ArgumentParser:
    parser = CliParser(description="Validate canonical sections in a Markdown submission.")
    parser.add_argument("--file", required=True, help="README or submission Markdown file")
    parser.add_argument(
        "--check-local-links",
        action="store_true",
        help="also require local Markdown link and image targets to exist; network URLs are skipped",
    )
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    path = Path(args.file)
    try:
        text = read_markdown(path)
    except InputError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    missing, empty = validate_sections(text)
    if args.check_local_links:
        missing_resources, invalid_destinations = local_resource_issues(text, path)
    else:
        missing_resources, invalid_destinations = [], []
    if missing or empty or missing_resources or invalid_destinations:
        print("Submission validation failed.")
        if missing:
            print("Missing sections: " + ", ".join(missing))
        if empty:
            print("Empty sections: " + ", ".join(empty))
        if missing_resources:
            print("Missing local resources: " + ", ".join(missing_resources))
        if invalid_destinations:
            print("Invalid Markdown destinations: " + ", ".join(invalid_destinations))
        return 1

    print("Submission validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
