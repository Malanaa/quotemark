# Contributing

1. Fork the repository and create a focused branch.
2. Install Node.js 22 or newer. Production code has no third-party dependencies.
3. Run `npm test` and `npm run check` before submitting a pull request.
4. Build with `npm run build`, load `dist/quotemark` unpacked in Chrome, and test the affected flow.

Keep the extension’s single purpose, limited permissions, and local-first behavior. Add meaningful tests for changes to capture, sync, authentication, or storage. UI fixes should include screenshots with synthetic data only.

Never commit OAuth tokens, private signing keys, real captured quotes, or client secrets. OAuth client IDs and extension public keys are not secrets. Avoid adding external runtime scripts or broad host permissions.

File issues with Chrome version, extension version, expected behavior, actual behavior, and sanitized reproduction steps. Use the repository’s private vulnerability reporting feature for a security issue if available; otherwise describe the issue without sensitive details and request a private reporting channel.
