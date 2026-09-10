"""Update only GP Work's uploads location, preserving the live TLS configuration."""
import argparse
from pathlib import Path
import re
import shutil
import subprocess


def private_uploads_config(source: str) -> str:
    matches = list(re.finditer(r'(?m)^([ \t]*)location\s+(?:\^~\s+)?/uploads/\s*\{', source))
    if len(matches) != 1:
        raise ValueError('Expected exactly one /uploads/ location; configuration left unchanged')
    match = matches[0]
    end = source.find('}', match.end())
    if end < 0 or '{' in source[match.end():end]:
        raise ValueError('Unexpected nested uploads configuration; configuration left unchanged')
    indent = match.group(1)
    lines = [
        'location ^~ /uploads/ {',
        '    proxy_pass http://127.0.0.1:3002;',
        '    proxy_http_version 1.1;',
        '    proxy_set_header Host $host;',
        '    proxy_set_header X-Real-IP $remote_addr;',
        '    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
        '    proxy_set_header X-Forwarded-Proto $scheme;',
        '    proxy_cache off;',
        '    proxy_hide_header Cache-Control;',
        '    expires off;',
        '    add_header Cache-Control "private, no-store, max-age=0" always;',
        '    add_header X-Content-Type-Options "nosniff" always;',
        '}',
    ]
    return source[:match.start()] + '\n'.join(indent + line for line in lines) + source[end + 1:]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', type=Path, required=True)
    parser.add_argument('--backup', type=Path, required=True)
    args = parser.parse_args()
    replacement = private_uploads_config(args.config.read_text())
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
    print('GP Work uploads proxy updated; existing TLS configuration preserved')


if __name__ == '__main__':
    main()
