import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('private_uploads', Path(__file__).with_name('ensure-private-uploads.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PrivateUploadsTest(unittest.TestCase):
    def test_preserves_tls_and_other_locations_and_is_idempotent(self):
        prefix = 'server {\n    listen 443 ssl;\n    ssl_certificate /etc/live/cert.pem;\n'
        suffix = '\n    location /api/ { proxy_pass http://127.0.0.1:3002; }\n}\n'
        source = prefix + '    location /uploads/ {\n        alias /old/public/;\n        expires 30d;\n    }' + suffix
        updated = module.private_uploads_config(source)
        self.assertTrue(updated.startswith(prefix))
        self.assertTrue(updated.endswith(suffix))
        self.assertNotIn('alias /old/public/', updated)
        self.assertNotIn('expires 30d', updated)
        self.assertIn('location ^~ /uploads/', updated)
        self.assertIn('proxy_cache off;', updated)
        self.assertIn('private, no-store, max-age=0', updated)
        self.assertEqual(updated, module.private_uploads_config(updated))

    def test_rejects_ambiguous_or_unknown_configuration(self):
        for source in ['server {}', 'location /uploads/ {}\nlocation /uploads/ {}', 'location /uploads/ { if ($x) { return 403; } }']:
            with self.subTest(source=source), self.assertRaises(ValueError):
                module.private_uploads_config(source)


if __name__ == '__main__':
    unittest.main()
