import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('web_cache', Path(__file__).with_name('ensure-web-cache.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class WebCacheTest(unittest.TestCase):
    def test_preserves_tls_private_media_api_and_hashed_assets(self):
        source = '''server {
    listen 443 ssl;
    ssl_certificate /live/fullchain.pem;
    add_header X-Frame-Options "DENY" always;
    location / {
        try_files $uri $uri/ /index.html;
    }
    location ^~ /uploads/ { proxy_pass http://127.0.0.1:3002; }
    location ^~ /api/ { proxy_pass http://127.0.0.1:3002; }
    location ~* \\.(js|css)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
'''
        updated = module.web_cache_config(source)
        for name in module.ENTRY_FILES:
            self.assertIn(f'location = /{name} {{\n        expires -1;', updated)
        self.assertIn('add_header Cache-Control "public, immutable";', updated)
        self.assertEqual(module.web_cache_config(updated), updated)
        start = updated.index('    ' + module.BEGIN)
        end = updated.index(module.END) + len(module.END) + 1
        self.assertEqual(updated[:start] + updated[end:], source)

    def test_does_not_guess_on_conflicting_or_ambiguous_configuration(self):
        for source in ['server {}', 'location / {}\nlocation / {}',
                       'location = /sw.js {}\nlocation / {}',
                       module.BEGIN + '\nlocation / {}',
                       module.END + '\n' + module.BEGIN + '\nlocation / {}']:
            with self.subTest(source=source), self.assertRaises(ValueError):
                module.web_cache_config(source)


if __name__ == '__main__':
    unittest.main()
