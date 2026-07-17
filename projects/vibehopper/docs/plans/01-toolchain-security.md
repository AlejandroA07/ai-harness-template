# Phase 1: Toolchain and Security Baseline

Status: Ready for Manuel's review

Branch: `toolchain-security-baseline`

## Outcome

Move the backend from its older compatible stack to a supported Spring Boot 3 baseline without
mixing in the Spring Boot 4 and Gradle 9 migrations.

## Changes

- Upgrade Spring Boot `3.3.4` to `3.5.16`.
- Upgrade Gradle `8.1.1` to the latest Gradle 8 maintenance release, `8.14.5`.
- Upgrade springdoc `2.6.0` to the Spring Boot 3.5-compatible `2.8.17` line.
- Upgrade the Spring dependency-management plugin within its current major version.
- Upgrade JJWT `0.11.5` to `0.13.0` and replace its deprecated builder/parser calls.
- Refresh and enforce Gradle dependency locks.
- Apply the current Dependabot-proposed SHA pins for checkout, Java setup, CodeQL, and Gitleaks.
- Replace Spring's deprecated security constructor and `@MockBean` test annotations.
- Retain Java 17 and Testcontainers-managed PostGIS integration tests.
- Keep GitHub Actions SHA-pinned and retain least-privilege workflow permissions.
- Defer Spring Boot 4, springdoc 3, and Gradle 9 to a dedicated post-MVP migration.

## Verification

- `./scripts/verify.sh` exits 0.
- Exactly 72 existing backend tests execute, with zero skipped tests and zero failures.
- `zizmor --pedantic .github/workflows/` has zero findings.
- Gitleaks reports no findings in committable files.
- `git diff --check` exits 0.
- Local docs and AI tooling remain ignored and uncommittable.

## Completion Gate

Manuel reviews, commits, pushes, and merges this branch before Phase 2 begins from updated `main`.
