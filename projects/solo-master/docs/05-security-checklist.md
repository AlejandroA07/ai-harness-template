# Solo Master — Security Checklist

Use this checklist for any change that adds or modifies an endpoint, authentication/authorization, user input, imported learning material, file handling, AI prompts, or learner-supplied code execution.

Record **pass**, **fail**, or **not applicable** for every section.

## Authentication and authorization

- The endpoint has an explicit authorization requirement or a written reason for anonymous access.
- Object-level access prevents one user from reading or changing another user's resources.
- Tokens and sessions use appropriate signing, expiry, storage, and transport.
- At least one test covers the denied path when authorization applies.

## Input and import validation

- Request payloads have explicit length, range, count, and format limits.
- Identifiers and enum-like values are validated against allowed values.
- Markdown or pasted content has size limits and is treated as untrusted.
- File uploads validate content type, extension, size, stored name, and destination.
- Archive or document extraction prevents path traversal and decompression bombs.

## Data exposure and privacy

- Responses expose only intended fields and cannot over-post persistence models.
- Error responses reveal no stack traces, SQL details, prompts, local paths, or provider internals.
- Logs contain no keys, tokens, full private learning material, or unnecessary personal data.
- AI provider requests disclose only the minimum required learner content and history.
- Retention and deletion behavior is explicit for attempts, prompts, and imported sources.

## Injection and output safety

- Database access is parameterized; SQL is never assembled with string interpolation.
- Razor output encoding remains enabled; raw HTML requires sanitization and justification.
- Redirect targets are local or allowlisted.
- Imported text is data, never trusted system instruction.
- Structured AI output is schema-validated before application use.
- AI-generated curriculum remains draft content until explicitly approved.

## AI tutoring and assessment integrity

- Tutor hints and canonical answers are unavailable during unaided mastery checks.
- A model response cannot directly grant mastery.
- Deterministic evidence takes precedence over AI judgment where available.
- AI uncertainty, parse failure, and provider failure produce safe recoverable states.
- Prompt and rubric versions are recorded for subjective evaluations.

## Learner code execution

- Execution happens outside the web process in an isolated disposable location.
- Time, memory/process, output, and file-system limits are enforced.
- Application secrets and unnecessary environment variables are removed.
- Network access is denied unless an exercise explicitly requires it.
- Temporary files and child processes are cleaned up after success, failure, and timeout.
- The code runner is not publicly exposed without a separate isolation review.

## Abuse resistance

- Expensive AI, import, and execution operations have quotas or rate limits appropriate to exposure.
- Authentication, recovery, and verification flows have rate limiting or lockout.
- Cancellation and timeouts exist for provider, database, import, and execution operations.
- Repeated failures cannot create unbounded storage, logs, processes, or provider cost.
