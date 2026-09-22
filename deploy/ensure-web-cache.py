"""Revalidate the GP Work entry files without replacing the live TLS config."""
import argparse
from pathlib import Path
import re
import shutil
import subprocess

BEGIN = '# GP Work entry revalidation: begin'
END = '# GP Work entry revalidation: end'
ENTRY_FILES = ('sw.js', 'index.html', 'version.json', 'manifest.webmanifest')


def web_cache_config(source: str) -> str:
    if BEGIN in source or END in source:
        if source.count(BEGIN) != 1 or source.count(END) != 1:
            raise ValueError('Ambiguous web cache block; configuration left unchanged')
        source, count = re.subn(
            r'(?m)^[ \t]*' + re.escape(BEGIN) + r'\n.*?^[ \t]*' + re.escape(END) + r'\n',
            '', source, flags=re.S,
        )
        if count != 1:
            raise ValueError('Incomplete web cache block; configuration left unchanged')
    roots = list(re.finditer(r'(?m)^([ \t]*)location\s+/\s*\{', source))
    if len(roots) != 1:
        raise ValueError('Expected exactly one SPA location; configuration left unchanged')
    for name in ENTRY_FILES:
        if re.search(r'location\s+(?:=\s+)?/' + re.escape(name) + r'\s*\{', source):
            raise ValueError('Existing entry location needs review; configuration left unchanged')
    match = roots[0]
    indent = match.group(1)
    lines = [BEGIN]
    for name in ENTRY_FILES:
        # expires -1 emits Cache-Control: no-cache without overriding inherited
        # security headers, unlike a new add_header in each location.
        lines += [f'location = /{name} {{', '    expires -1;', '    try_files $uri =404;', '}']
    lines += [END]
    block = '\n'.join(indent + line for line in lines) + '\n'
    return source[:match.start()] + block + source[match.start():]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', type=Path, required=True)
    parser.add_argument('--backup', type=Path, required=True)
    args = parser.parse_args()
    replacement = web_cache_config(args.config.read_text())
    shutil.copy2(args.config, args.backup)
    try:
        args.config.write_text(replacement)
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    except BaseException:
        shutil.copy2(args.backup, args.config)
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
        raise
    print('GP Work entry files revalidate; TLS, API, uploads and asset cache preserved')


if __name__ == '__main__':
    main()
