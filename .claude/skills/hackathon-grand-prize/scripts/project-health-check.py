#!/usr/bin/env python3
"""Evaluate the canonical project readiness health gate."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Optional


CHECKS = (
    "build_passes",
    "tests_pass",
    "lint_or_typecheck_passes",
    "core_flows_work",
    "error_flows_work",
    "authorization_enforced",
    "inputs_validated",
    "api_failures_handled",
    "data_integrity_verified",
    "retries_safe",
    "security_reviewed",
    "secrets_scanned",
    "demo_fallback_ready",
)
NOT_APPLICABLE_STATUS = "not_applicable"
NOT_APPLICABLE_ALLOWED = {
    "build_passes",
    "tests_pass",
    "lint_or_typecheck_passes",
    "authorization_enforced",
    "api_failures_handled",
    "data_integrity_verified",
    "retries_safe",
}
MIN_RATIONALE_LENGTH = 20


class InputError(ValueError):
    """Raised for invalid user input."""


class CliParser(argparse.ArgumentParser):
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


def _parse_check_value(check: str, value: Any) -> Any:
    if type(value) is bool:
        return value
    if not isinstance(value, dict):
        raise InputError(
            f"check {check!r} must be true, false, or a not_applicable object"
        )
    if check not in NOT_APPLICABLE_ALLOWED:
        raise InputError(f"check {check!r} is mandatory and cannot be not_applicable")

    expected = {"status", "rationale"}
    keys = set(value)
    if keys != expected:
        missing = sorted(expected - keys)
        unknown = sorted(keys - expected)
        details = []
        if missing:
            details.append("missing keys: " + ", ".join(missing))
        if unknown:
            details.append("unknown keys: " + ", ".join(unknown))
        raise InputError(f"check {check!r} not_applicable object has " + "; ".join(details))
    if value["status"] != NOT_APPLICABLE_STATUS:
        raise InputError(
            f"check {check!r} object status must be {NOT_APPLICABLE_STATUS!r}"
        )
    rationale = value["rationale"]
    if not isinstance(rationale, str) or len(rationale.strip()) < MIN_RATIONALE_LENGTH:
        raise InputError(
            f"check {check!r} not_applicable rationale must be a specific string "
            f"of at least {MIN_RATIONALE_LENGTH} characters"
        )
    return {"status": NOT_APPLICABLE_STATUS, "rationale": rationale.strip()}


def parse_checks(raw: str) -> dict[str, Any]:
    try:
        payload = json.loads(
            raw,
            parse_constant=_reject_constant,
            object_pairs_hook=_pairs_to_object,
        )
    except (json.JSONDecodeError, ValueError) as exc:
        raise InputError(f"--checks-json is not valid JSON: {exc}") from None
    if not isinstance(payload, dict):
        raise InputError("--checks-json must be a JSON object")

    missing = [check for check in CHECKS if check not in payload]
    unknown = sorted(key for key in payload if key not in CHECKS)
    problems = []
    if missing:
        problems.append("missing checks: " + ", ".join(missing))
    if unknown:
        problems.append("unknown checks: " + ", ".join(unknown))
    if problems:
        raise InputError("--checks-json has " + "; ".join(problems))

    return {check: _parse_check_value(check, payload[check]) for check in CHECKS}


def evaluate(payload: dict[str, Any]) -> tuple[list[str], list[tuple[str, str]]]:
    failed = [check for check in CHECKS if payload[check] is False]
    skipped = [
        (check, payload[check]["rationale"])
        for check in CHECKS
        if isinstance(payload[check], dict)
    ]
    return failed, skipped


def build_parser() -> argparse.ArgumentParser:
    parser = CliParser(
        description=(
            "Evaluate build, quality, core/error flows, authorization, input/API/data/retry "
            "reliability, security, secrets, and demo fallback readiness. Each check must be "
            "true, false, or a justified not_applicable object."
        )
    )
    parser.add_argument(
        "--checks-json",
        required=True,
        help=(
            "JSON object containing every documented check as true, false, or "
            '{"status":"not_applicable","rationale":"why this cannot apply"}'
        ),
    )
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        payload = parse_checks(args.checks_json)
    except InputError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    failed, skipped = evaluate(payload)
    if skipped:
        print("Not-applicable checks accepted with rationale:")
        for check, rationale in skipped:
            print(f"- {check}: {rationale}")
    if failed:
        print("Health check failed. Resolve or verify these checks first:")
        for check in failed:
            print(f"- {check}")
        return 1

    print("Health check passed: all applicable checks are ready for demo/pitch rehearsal.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
