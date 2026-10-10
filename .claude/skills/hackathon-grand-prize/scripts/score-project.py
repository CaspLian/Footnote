#!/usr/bin/env python3
"""Score the canonical Phase 12 hackathon final scorecard."""

from __future__ import annotations

import argparse
import json
import math
import sys
from typing import Any, Optional


CRITERIA = (
    "problem",
    "innovation",
    "technical_execution",
    "sponsor_integration",
    "ux_design",
    "demo",
    "real_world_impact",
    "completeness",
    "reliability",
    "pitch",
    "memorability",
)
DEFAULT_WEIGHTS = {criterion: 1.0 for criterion in CRITERIA}


class InputError(ValueError):
    """Raised for invalid user input."""


class CliParser(argparse.ArgumentParser):
    """Argument parser with concise, stable usage errors."""

    def error(self, message: str) -> None:
        self.exit(2, f"error: {message}\n")


def _reject_constant(value: str) -> None:
    raise ValueError(f"non-finite number {value!r} is not valid JSON input")


def _pairs_to_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate key {key!r}")
        result[key] = value
    return result


def parse_json_object(raw: str, label: str) -> dict[str, Any]:
    try:
        value = json.loads(
            raw,
            parse_constant=_reject_constant,
            object_pairs_hook=_pairs_to_object,
        )
    except (json.JSONDecodeError, ValueError) as exc:
        raise InputError(f"{label} is not valid JSON: {exc}") from None
    if not isinstance(value, dict):
        raise InputError(f"{label} must be a JSON object")
    return value


def require_exact_keys(value: dict[str, Any], label: str) -> None:
    missing = [key for key in CRITERIA if key not in value]
    unknown = sorted(key for key in value if key not in CRITERIA)
    problems = []
    if missing:
        problems.append("missing keys: " + ", ".join(missing))
    if unknown:
        problems.append("unknown keys: " + ", ".join(unknown))
    if problems:
        raise InputError(f"{label} has " + "; ".join(problems))


def finite_number(value: Any, label: str) -> float:
    if type(value) not in (int, float):
        raise InputError(f"{label} must be a finite real number")
    try:
        number = float(value)
    except (OverflowError, ValueError):
        raise InputError(f"{label} must be a finite real number") from None
    if not math.isfinite(number):
        raise InputError(f"{label} must be a finite real number")
    return number


def parse_scores(raw: str) -> dict[str, float]:
    payload = parse_json_object(raw, "--scores-json")
    require_exact_keys(payload, "--scores-json")

    scores: dict[str, float] = {}
    for criterion in CRITERIA:
        score = finite_number(payload[criterion], f"score {criterion!r}")
        if not 0.0 <= score <= 10.0:
            raise InputError(f"score {criterion!r} must be between 0 and 10")
        scores[criterion] = score
    return scores


def parse_weights(raw: Optional[str]) -> dict[str, float]:
    if raw is None:
        return dict(DEFAULT_WEIGHTS)

    payload = parse_json_object(raw, "--weights-json")
    require_exact_keys(payload, "--weights-json")

    weights: dict[str, float] = {}
    for criterion in CRITERIA:
        weight = finite_number(payload[criterion], f"weight {criterion!r}")
        if weight < 0.0:
            raise InputError(f"weight {criterion!r} must be nonnegative")
        weights[criterion] = weight

    total = sum(weights.values())
    if not math.isfinite(total) or total <= 0.0:
        raise InputError("weights must have a finite positive total")
    return weights


def classify(score: float) -> str:
    if score < 60:
        return "unlikely to be competitive"
    if score < 70:
        return "decent submission"
    if score < 80:
        return "competitive"
    if score < 90:
        return "strong finalist potential"
    if score < 95:
        return "elite"
    return "grand-prize caliber"


def compute(scores: dict[str, float], weights: dict[str, float]) -> float:
    total_weight = sum(weights.values())
    weighted_score = sum(
        scores[criterion] * (weights[criterion] / total_weight)
        for criterion in CRITERIA
    )
    return round(weighted_score * 10.0, 1)


def build_parser() -> argparse.ArgumentParser:
    parser = CliParser(
        description=(
            "Score every criterion in the canonical Phase 12 final scorecard. "
            "All criteria use equal weights unless --weights-json is supplied."
        )
    )
    parser.add_argument(
        "--scores-json",
        required=True,
        help="JSON object containing every Phase 12 criterion with a score from 0 to 10",
    )
    parser.add_argument(
        "--weights-json",
        help=(
            "optional JSON object with every criterion mapped to a finite, "
            "nonnegative custom weight"
        ),
    )
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        scores = parse_scores(args.scores_json)
        weights = parse_weights(args.weights_json)
        overall = compute(scores, weights)
        output = {
            "scorecard": "Phase 12 final scorecard",
            "scores": scores,
            "weights": weights,
            "overall": overall,
            "classification": classify(overall),
        }
        print(json.dumps(output, indent=2, allow_nan=False))
        return 0
    except InputError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
