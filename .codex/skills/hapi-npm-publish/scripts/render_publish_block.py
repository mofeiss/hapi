#!/usr/bin/env python3
import argparse
import shlex
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description='Render the canonical HAPI npm publish block.')
    parser.add_argument('--repo-root', required=True)
    parser.add_argument('--version', required=True)
    parser.add_argument('--npm-user', required=True)
    args = parser.parse_args()

    repo_root = Path(args.repo_root).expanduser().resolve()
    version = args.version.strip()
    npm_user = args.npm_user.strip()

    if not repo_root.is_absolute():
        raise SystemExit('--repo-root must be an absolute path')
    if not version:
        raise SystemExit('--version must not be empty')
    if not npm_user:
        raise SystemExit('--npm-user must not be empty')

    lines = [
        '```bash',
        f'REPO_ROOT={shlex.quote(str(repo_root))}',
        f'EXPECTED_NPM_USER={shlex.quote(npm_user)}',
        f'EXPECTED_VERSION={shlex.quote(version)}',
        'set -euo pipefail',
        '',
        'cd "$REPO_ROOT"',
        '',
        'CURRENT_NPM_USER="$(npm whoami 2>/dev/null || true)"',
        'if [ "$CURRENT_NPM_USER" != "$EXPECTED_NPM_USER" ]; then',
        '    echo "npm 当前账号: ${CURRENT_NPM_USER:-<none>}，期望账号: $EXPECTED_NPM_USER"',
        '    npm login',
        '    CURRENT_NPM_USER="$(npm whoami 2>/dev/null || true)"',
        '    [ "$CURRENT_NPM_USER" = "$EXPECTED_NPM_USER" ]',
        'fi',
        '',
        '''ACTUAL_VERSION="$(node -p 'require("./cli/package.json").version')"''',
        '[ "$ACTUAL_VERSION" = "$EXPECTED_VERSION" ]',
        '',
        'DARWIN_ARM64_TGZ="$REPO_ROOT/cli/npm/darwin-arm64/ofeiss-hapi-darwin-arm64-$EXPECTED_VERSION.tgz"',
        'DARWIN_X64_TGZ="$REPO_ROOT/cli/npm/darwin-x64/ofeiss-hapi-darwin-x64-$EXPECTED_VERSION.tgz"',
        'LINUX_ARM64_TGZ="$REPO_ROOT/cli/npm/linux-arm64/ofeiss-hapi-linux-arm64-$EXPECTED_VERSION.tgz"',
        'LINUX_X64_TGZ="$REPO_ROOT/cli/npm/linux-x64/ofeiss-hapi-linux-x64-$EXPECTED_VERSION.tgz"',
        'WIN32_X64_TGZ="$REPO_ROOT/cli/npm/win32-x64/ofeiss-hapi-win32-x64-$EXPECTED_VERSION.tgz"',
        'MAIN_TGZ="$REPO_ROOT/cli/npm/main/ofeiss-hapi-$EXPECTED_VERSION.tgz"',
        '',
        '[ -f "$DARWIN_ARM64_TGZ" ]',
        '[ -f "$DARWIN_X64_TGZ" ]',
        '[ -f "$LINUX_ARM64_TGZ" ]',
        '[ -f "$LINUX_X64_TGZ" ]',
        '[ -f "$WIN32_X64_TGZ" ]',
        '[ -f "$MAIN_TGZ" ]',
        '',
        'npm publish --access public "$DARWIN_ARM64_TGZ"',
        'npm publish --access public "$DARWIN_X64_TGZ"',
        'npm publish --access public "$LINUX_ARM64_TGZ"',
        'npm publish --access public "$LINUX_X64_TGZ"',
        'npm publish --access public "$WIN32_X64_TGZ"',
        'npm publish --access public "$MAIN_TGZ"',
        '```',
    ]

    sys.stdout.write('\n'.join(lines) + '\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
