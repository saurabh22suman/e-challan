"""Black-box negative checks for SET-03/SET-04; mutate only isolated tmp fixtures."""
import json
import random
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class GuardAcceptance(unittest.TestCase):
    def command(self, script, *args):
        result = subprocess.run(["pnpm", "run", script, *args], cwd=ROOT, text=True,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=90)
        self.assertNotIn("Missing script", result.stdout, f"Missing harness: {result.stdout}")
        self.assertNotIn("Command not found", result.stdout, f"Missing harness: {result.stdout}")
        return result

    def check_import(self, source, should_pass, origin="apps/tablet"):
        with tempfile.TemporaryDirectory(prefix="echallan-boundary-") as folder:
            root = Path(folder)
            (root / 'package.json').write_text(json.dumps({'name': 'boundary-fixture', 'private': True}))
            (root / 'pnpm-workspace.yaml').write_text("packages:\n  - 'apps/*'\n  - 'packages/*'\n")
            for package, name in [("apps/tablet", "tablet"), ("apps/admin", "admin"),
                                  ("apps/api", "api"), ("packages/contracts", "contracts"),
                                  ("packages/theme", "theme")]:
                directory = root / package
                (directory / "src").mkdir(parents=True)
                (directory / "package.json").write_text(json.dumps({"name": f"@echallan/{name}"}))
                (directory / "src/index.ts").write_text("export const fixture = true;\n")
            (root / origin / "src/probe.tsx").write_text(source)
            result = self.command("check:boundaries", "--root", str(root))
            if should_pass:
                self.assertEqual(result.returncode, 0, result.stdout)
            else:
                self.assertNotEqual(result.returncode, 0, f"Forbidden import passed: {source}")
                self.assertRegex(result.stdout.lower(), r"boundary|forbidden|restricted|barrel")

    def test_allowed_shared_and_exact_mui_imports(self):
        self.check_import("import { fixture } from '@echallan/contracts';\n"
                          "import Button from '@mui/material/Button';\n"
                          "import Camera from '@mui/icons-material/Camera';\n", True)

    def test_cross_app_relative_import_rejected(self):
        self.check_import("import { fixture } from '../../admin/src/index';\n", False)

    def test_cross_app_package_import_rejected(self):
        self.check_import("import { fixture } from '@echallan/admin';\n", False)

    def test_mui_and_icon_barrels_rejected(self):
        for source in ["import { Button } from '@mui/material';\n",
                       "import { Camera } from '@mui/icons-material';\n",
                       "const forbidden = import('@mui/material');\n"]:
            with self.subTest(source=source):
                self.check_import(source, False)

    def test_admin_only_tablet_widget_rejected(self):
        for package in ("@mui/x-data-grid", "@mui/x-charts", "@mui/x-date-pickers"):
            with self.subTest(package=package):
                self.check_import(f"import Widget from '{package}';\n", False)

    def test_other_directions_exports_and_dynamic_imports(self):
        for source, origin in [
            ("export { fixture } from '@echallan/api';\n", "apps/admin"),
            ("const forbidden = import('@echallan/tablet');\n", "apps/api"),
            ("export { Button } from '@mui/material';\n", "packages/theme"),
        ]:
            with self.subTest(origin=origin, source=source):
                self.check_import(source, False, origin)

    def check_size(self, entry_bytes, lazy_bytes, should_pass, vendor_bytes=1000,
                   compressible=False, nested=False, duplicate=False, fault=None):
        with tempfile.TemporaryDirectory(prefix="echallan-size-") as folder:
            dist = Path(folder)
            (dist / "assets").mkdir()
            (dist / ".vite").mkdir()
            rng = random.Random(42)
            (dist / "assets/entry.js").write_bytes(b"a" * entry_bytes if compressible else rng.randbytes(entry_bytes))
            (dist / "assets/vendor.js").write_bytes(rng.randbytes(vendor_bytes))
            (dist / "assets/lazy.js").write_bytes(rng.randbytes(lazy_bytes))
            manifest = {
                "index.html": {"file": "assets/entry.js", "isEntry": True,
                               "imports": ["vendor"], "dynamicImports": ["lazy"]},
                "vendor": {"file": "assets/vendor.js"},
                "lazy": {"file": "assets/lazy.js", "isDynamicEntry": True},
            }
            if nested:
                manifest['index.html']['imports'] = ['bridge']
                manifest['bridge'] = {'file': 'assets/bridge.js', 'imports': ['vendor']}
                (dist / 'assets/bridge.js').write_bytes(b'export const bridge = true;')
            if duplicate:
                manifest['index.html']['imports'] = ['vendor', 'bridge']
                manifest['bridge'] = {'file': 'assets/bridge.js', 'imports': ['vendor']}
                (dist / 'assets/bridge.js').write_bytes(b'export const bridge = true;')
            (dist / ".vite/manifest.json").write_text(json.dumps(manifest))
            if fault == 'missing-manifest':
                (dist / '.vite/manifest.json').unlink()
            elif fault == 'malformed-manifest':
                (dist / '.vite/manifest.json').write_text('{ broken')
            elif fault == 'missing-asset':
                (dist / 'assets/vendor.js').unlink()
            result = self.command("check:tablet-size", "--dist", str(dist))
            if should_pass:
                self.assertEqual(result.returncode, 0, result.stdout)
            else:
                self.assertNotEqual(result.returncode, 0, "Over-budget initial JS passed")
                self.assertRegex(result.stdout.lower(), r"budget|exceed|250|manifest|missing|asset|invalid|enoent")

    def test_small_initial_bundle_excludes_lazy_route(self):
        self.check_size(1000, 300000, True)

    def test_large_initial_bundle_rejected(self):
        self.check_size(260000, 1000, False)

    def test_gzip_not_uncompressed_size(self):
        self.check_size(300000, 1000, True, compressible=True)

    def test_recursive_static_vendor_counts(self):
        self.check_size(1000, 1000, False, vendor_bytes=260000, nested=True)

    def test_static_imports_counted_once(self):
        self.check_size(1000, 1000, True, vendor_bytes=180000, duplicate=True)

    def test_missing_or_malformed_build_fails(self):
        for fault in ('missing-manifest', 'malformed-manifest', 'missing-asset'):
            with self.subTest(fault=fault):
                self.check_size(1000, 1000, False, fault=fault)


if __name__ == "__main__":
    unittest.main()
