"""Planner-owned regression checks for the S-01 review findings R1-R4.

Prepared by the planner session (2026-10-02) after the independent review in
`docs/reviews/S-01.md` returned CHANGES_REQUIRED with findings R1 (clean-artifact
gate order), R2 (app-package subpath boundaries), R3 (surface-specific widget
restrictions) and R4 (genuine lazy-loading evidence).

These are read-only acceptance inputs for the implementer. They never modify the
repository: clean-workspace copies are created under the system temporary
directory with `shutil.copytree`, dependency installation inside them is a real
`pnpm install --frozen-lockfile`, and boundary fixtures are temporary trees. No
check is skipped, and a missing tool or service is reported as a failure rather
than as a pass.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COMMAND_TIMEOUT_SECONDS = 900

# Everything a clean checkout must not contain when a gate is expected to work.
GENERATED_PATTERNS = ('dist', '.env', '*.tsbuildinfo')

# Route module that each app is expected to code-split, relative to the app root.
APP_ROUTE_MODULES = {
    'tablet': 'src/routes/EntryFlow.tsx',
    'admin': 'src/routes/DashboardScreen.tsx',
}


def run(command, cwd, timeout=COMMAND_TIMEOUT_SECONDS):
    return subprocess.run(
        command,
        cwd=cwd,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout,
    )


def copy_without_generated_artifacts(destination: Path) -> Path:
    """Copy the workspace into `destination`, excluding node_modules and output."""
    shutil.copytree(
        ROOT,
        destination,
        ignore=shutil.ignore_patterns(
            'node_modules',
            'dist',
            '.env',
            '*.tsbuildinfo',
            'test-results',
            'playwright-report',
            '__pycache__',
        ),
        symlinks=True,
    )
    return destination


def install_dependencies(workspace: Path) -> None:
    """Install exactly the committed lockfile inside the disposable copy.

    The warm pnpm store normally satisfies this offline; a network install is the
    documented fallback so the check also runs on a cold CI runner.
    """
    offline = run(['pnpm', 'install', '--frozen-lockfile', '--offline', '--ignore-scripts'], workspace)
    if offline.returncode != 0:
        online = run(['pnpm', 'install', '--frozen-lockfile'], workspace)
        if online.returncode != 0:
            raise AssertionError(
                'clean-workspace pnpm install --frozen-lockfile failed (offline and online):\n'
                f'{online.stdout}'
            )


class R1CleanArtifactGateOrder(unittest.TestCase):
    """R1: the documented gates must work without pre-existing build output.

    The declared smoke checks only inspect command and workflow text, so they
    cannot catch a gate that is only green because a developer's local `dist/`
    exists. This check runs the real gate in a disposable workspace that starts
    without any `dist/`, `.env` or `*.tsbuildinfo`.
    """

    @classmethod
    def setUpClass(cls):
        cls.workspace = copy_without_generated_artifacts(
            Path(tempfile.mkdtemp(prefix='echallan-r1-clean-')) / 'workspace'
        )
        for pattern in GENERATED_PATTERNS:
            generated = [
                path.relative_to(cls.workspace)
                for path in cls.workspace.rglob(pattern)
                if 'node_modules' not in path.parts
            ]
            if generated:
                raise AssertionError(f'disposable workspace is not clean: {generated[:5]}')
        install_dependencies(cls.workspace)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.workspace, ignore_errors=True)

    def test_documented_typecheck_gate_succeeds_without_generated_artifacts(self):
        result = run(['pnpm', 'run', 'typecheck'], self.workspace)

        self.assertEqual(
            result.returncode,
            0,
            'R1: `pnpm typecheck` must succeed from a clean checkout without a prior '
            'shared-package build. Failing output:\n' + result.stdout[-4000:],
        )

    def test_documented_unit_test_gate_succeeds_without_generated_artifacts(self):
        result = run(['pnpm', 'run', 'test'], self.workspace)

        self.assertEqual(
            result.returncode,
            0,
            'R1: `pnpm test` must succeed from a clean checkout. Failing output:\n'
            + result.stdout[-4000:],
        )


class R2AppPackageSubpathBoundaries(unittest.TestCase):
    """R2: app-package imports are forbidden as bare names and as subpaths."""

    def fixture(self, origin, source):
        temporary = tempfile.mkdtemp(prefix='echallan-r2-boundary-')
        self.addCleanup(shutil.rmtree, temporary, ignore_errors=True)
        root = Path(temporary)
        (root / 'package.json').write_text(json.dumps({'name': 'boundary-fixture', 'private': True}))
        (root / 'pnpm-workspace.yaml').write_text("packages:\n  - 'apps/*'\n  - 'packages/*'\n")
        for package, name in (
            ('apps/tablet', 'tablet'),
            ('apps/admin', 'admin'),
            ('apps/api', 'api'),
            ('packages/contracts', 'contracts'),
            ('packages/theme', 'theme'),
        ):
            source_directory = root / package / 'src'
            source_directory.mkdir(parents=True)
            (root / package / 'package.json').write_text(json.dumps({'name': f'@echallan/{name}'}))
            (source_directory / 'index.ts').write_text('export const fixture = true;\n')
        probe = root / origin / 'src' / 'probe.ts'
        probe.write_text(source)
        result = run(['pnpm', 'run', 'check:boundaries', '--root', str(root)], ROOT)
        return result

    def assertForbidden(self, source, origin='apps/tablet'):
        result = self.fixture(origin, source)
        self.assertNotEqual(
            result.returncode,
            0,
            f'R2: forbidden import was accepted: {source.strip()}',
        )
        self.assertRegex(result.stdout.lower(), r'boundary|forbidden|restricted|barrel')

    def test_allowed_shared_package_imports_remain_accepted(self):
        # Bare shared-package names must keep working. Deep subpath imports of
        # shared packages (for example `@echallan/contracts/dist/index.js`) are
        # deliberately not asserted here: they are an export-map concern that
        # belongs to the F-01 contracts, not to this boundary gate.
        for source in (
            "import { fixture } from '@echallan/contracts';\n",
            "import { fixture } from '@echallan/theme';\n",
        ):
            with self.subTest(source=source):
                result = self.fixture('apps/tablet', source)
                self.assertEqual(result.returncode, 0, result.stdout)

    def test_app_package_subpath_imports_are_rejected(self):
        cases = (
            ('apps/tablet', "import { fixture } from '@echallan/admin/src/App';\n"),
            ('apps/tablet', "import { fixture } from '@echallan/api/dist/server.js';\n"),
            ('apps/admin', "import { fixture } from '@echallan/tablet/e2e/foundation.spec';\n"),
            ('apps/admin', "export { fixture } from '@echallan/api/src/app.js';\n"),
            ('apps/api', "const forbidden = import('@echallan/tablet/src/App');\n"),
            ('apps/tablet', "export * from '@echallan/admin/src/index';\n"),
        )
        for origin, source in cases:
            with self.subTest(origin=origin, source=source):
                self.assertForbidden(source, origin)

    def test_bare_app_package_imports_remain_rejected(self):
        for origin, source in (
            ('apps/tablet', "import { fixture } from '@echallan/admin';\n"),
            ('apps/admin', "export { fixture } from '@echallan/api';\n"),
            ('apps/api', "const forbidden = import('@echallan/tablet');\n"),
        ):
            with self.subTest(origin=origin, source=source):
                self.assertForbidden(source, origin)


class R3SurfaceSpecificWidgetRestrictions(unittest.TestCase):
    """R3: admin-only MUI X widgets are allowed in admin, banned in tablet/shared."""

    WIDGETS = ('@mui/x-data-grid', '@mui/x-charts', '@mui/x-date-pickers')

    def fixture(self, origin, source):
        temporary = tempfile.mkdtemp(prefix='echallan-r3-boundary-')
        self.addCleanup(shutil.rmtree, temporary, ignore_errors=True)
        root = Path(temporary)
        (root / 'package.json').write_text(json.dumps({'name': 'widget-fixture', 'private': True}))
        (root / 'pnpm-workspace.yaml').write_text("packages:\n  - 'apps/*'\n  - 'packages/*'\n")
        for package, name in (
            ('apps/tablet', 'tablet'),
            ('apps/admin', 'admin'),
            ('apps/api', 'api'),
            ('packages/contracts', 'contracts'),
            ('packages/theme', 'theme'),
        ):
            source_directory = root / package / 'src'
            source_directory.mkdir(parents=True)
            (root / package / 'package.json').write_text(json.dumps({'name': f'@echallan/{name}'}))
            (source_directory / 'index.ts').write_text('export const fixture = true;\n')
        (root / origin / 'src' / 'probe.ts').write_text(source)
        result = run(['pnpm', 'run', 'check:boundaries', '--root', str(root)], ROOT)
        return result

    def assertForbidden(self, source, origin):
        result = self.fixture(origin, source)
        self.assertNotEqual(
            result.returncode,
            0,
            f'R3: admin-only widget was accepted in {origin}: {source.strip()}',
        )
        self.assertRegex(result.stdout.lower(), r'boundary|forbidden|restricted|barrel|admin-only')

    def test_admin_only_widgets_are_allowed_inside_the_admin_app(self):
        sources = [
            f"import Widget from '{widget}';\n" for widget in self.WIDGETS
        ] + [f"import Widget from '{widget}/DataGrid';\n" for widget in self.WIDGETS]
        for source in sources:
            with self.subTest(source=source):
                result = self.fixture('apps/admin', source)
                self.assertEqual(result.returncode, 0, result.stdout)

    def test_admin_only_widgets_remain_rejected_in_tablet(self):
        for source in [f"import Widget from '{widget}';\n" for widget in self.WIDGETS]:
            with self.subTest(source=source):
                self.assertForbidden(source, 'apps/tablet')

    def test_admin_only_widgets_remain_rejected_in_shared_client_packages(self):
        for package in ('packages/theme', 'packages/contracts'):
            for source in [f"import Widget from '{widget}';\n" for widget in self.WIDGETS]:
                with self.subTest(package=package, source=source):
                    self.assertForbidden(source, package)


class R4LazyRouteCodeSplitting(unittest.TestCase):
    """R4: the production build must really code-split the lazy route.

    Conditional rendering with an eager import satisfies every existing component
    test, so this check inspects the production Vite manifest instead: the route
    module must be a dynamic entry, reachable only through `dynamicImports`, and
    never part of the initial entry's static graph.
    """

    @classmethod
    def setUpClass(cls):
        cls.workspace = copy_without_generated_artifacts(
            Path(tempfile.mkdtemp(prefix='echallan-r4-build-')) / 'workspace'
        )
        install_dependencies(cls.workspace)
        shared = run(['pnpm', 'run', 'build:packages'], cls.workspace)
        if shared.returncode != 0:
            raise AssertionError(f'build:packages failed in the disposable copy:\n{shared.stdout}')
        for app in APP_ROUTE_MODULES:
            built = run(['pnpm', '--filter', f'@echallan/{app}', 'run', 'build'], cls.workspace)
            if built.returncode != 0:
                raise AssertionError(f'{app} production build failed:\n{built.stdout}')

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.workspace, ignore_errors=True)

    def manifest_for(self, app):
        path = self.workspace / 'apps' / app / 'dist' / '.vite' / 'manifest.json'
        self.assertTrue(path.is_file(), f'{app}: missing production manifest {path}')
        return json.loads(path.read_text())

    def test_each_app_code_splits_its_lazy_route(self):
        for app, route_module in APP_ROUTE_MODULES.items():
            with self.subTest(app=app):
                manifest = self.manifest_for(app)
                entries = {key: value for key, value in manifest.items() if value.get('isEntry')}
                self.assertEqual(
                    len(entries), 1, f'{app}: expected exactly one initial entry chunk'
                )
                entry_key, entry = next(iter(entries.items()))

                dynamic_imports = entry.get('dynamicImports', [])
                self.assertIn(
                    route_module,
                    dynamic_imports,
                    f'{app}: the initial entry does not dynamically import {route_module}; '
                    f'the route is bundled into the initial payload (R4)',
                )

                chunk = manifest.get(route_module)
                self.assertIsNotNone(chunk, f'{app}: no manifest entry for {route_module}')
                self.assertTrue(
                    chunk.get('isDynamicEntry'),
                    f'{app}: {route_module} is not a dynamic entry chunk',
                )
                self.assertNotEqual(
                    chunk.get('file'),
                    entry.get('file'),
                    f'{app}: the lazy route shares the initial chunk file',
                )
                self.assertTrue(
                    (self.workspace / 'apps' / app / 'dist' / chunk['file']).is_file(),
                    f'{app}: lazy route chunk {chunk["file"]} was not emitted',
                )

    def test_initial_graph_never_statically_imports_a_route_module(self):
        for app, route_module in APP_ROUTE_MODULES.items():
            with self.subTest(app=app):
                manifest = self.manifest_for(app)
                entry_key = next(key for key, value in manifest.items() if value.get('isEntry'))
                static_graph = []
                queue = [entry_key]
                while queue:
                    key = queue.pop()
                    if key in static_graph:
                        continue
                    static_graph.append(key)
                    queue.extend(manifest.get(key, {}).get('imports', []))
                for key in static_graph:
                    self.assertNotEqual(
                        manifest.get(key, {}).get('src'),
                        route_module,
                        f'{app}: {route_module} is reachable through static imports',
                    )
                self.assertNotIn(route_module, static_graph)

    def test_route_module_is_loaded_through_a_dynamic_import(self):
        for app, route_module in APP_ROUTE_MODULES.items():
            with self.subTest(app=app):
                shell = self.workspace / 'apps' / app / 'src' / 'App.tsx'
                self.assertTrue(shell.is_file(), f'{app}: missing application shell {shell}')
                text = shell.read_text()
                module = './' + route_module.removeprefix('src/').removesuffix('.tsx')
                self.assertRegex(
                    text,
                    rf'import\(\s*[\'\"]{re.escape(module)}[\'\"]\s*\)',
                    f'{app}: {shell.name} does not load {module} through a literal dynamic '
                    'import, so the route cannot be code-split (R4)',
                )


if __name__ == '__main__':
    unittest.main()
