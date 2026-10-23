"""Planner-owned S-01 setup checks; Python stdlib only, runnable before pnpm setup."""
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGES = {
    "apps/api": "@echallan/api",
    "apps/tablet": "@echallan/tablet",
    "apps/admin": "@echallan/admin",
    "packages/contracts": "@echallan/contracts",
    "packages/theme": "@echallan/theme",
}
SCRIPTS = {
    "dev", "format:check", "lint", "typecheck", "test", "test:integration",
    "test:e2e", "test:foundation", "build", "check:boundaries", "check:tablet-size",
    "db:up", "db:down", "db:migrate", "db:seed:demo",
}


class WorkspaceAcceptance(unittest.TestCase):
    def manifest(self, directory="."):
        path = ROOT / directory / "package.json"
        self.assertTrue(path.is_file(), f"SET-01: missing manifest {path.relative_to(ROOT)}")
        return json.loads(path.read_text())

    def test_pinned_private_workspace_and_root_commands(self):
        package = self.manifest()
        self.assertTrue(package.get("private"), "Workspace must not publish accidentally")
        self.assertRegex(package.get("packageManager", ""), r"^pnpm@\d+\.\d+\.\d+")
        self.assertIn("22", package.get("engines", {}).get("node", ""))
        scripts = package.get("scripts", {})
        self.assertFalse(SCRIPTS - scripts.keys(), f"Missing commands: {SCRIPTS - scripts.keys()}")
        self.assertIn("check:boundaries", scripts["lint"], "SET-03: lint must include the boundary gate")
        for name in SCRIPTS:
            self.assertTrue(scripts[name].strip(), f"Empty script: {name}")
            self.assertNotRegex(scripts[name], r"(?i)(echo|printf).*?(todo|passed|not implemented)|\|\|\s*true")
        workspace = ROOT / "pnpm-workspace.yaml"
        self.assertTrue(workspace.is_file(), "SET-01: missing pnpm workspace")
        self.assertRegex(workspace.read_text(), r"apps/\*")
        self.assertRegex(workspace.read_text(), r"packages/\*")
        self.assertTrue((ROOT / "pnpm-lock.yaml").is_file(), "Commit a reproducible lockfile")

    def test_five_named_packages_and_shared_dependencies(self):
        packages = {path: self.manifest(path) for path in PACKAGES}
        for path, name in PACKAGES.items():
            self.assertEqual(packages[path].get("name"), name)
            self.assertTrue(packages[path].get("private"))
            all_deps = {**packages[path].get("dependencies", {}), **packages[path].get("devDependencies", {})}
            self.assertFalse({"@echallan/api", "@echallan/tablet", "@echallan/admin"} & all_deps.keys())
            for dep, version in all_deps.items():
                if dep.startswith("@echallan/"):
                    self.assertIn(version, {"workspace:*", "workspace:^", "workspace:~"})
        for path in ("apps/api", "apps/tablet", "apps/admin"):
            self.assertIn("@echallan/contracts", packages[path].get("dependencies", {}))
        for path in ("apps/tablet", "apps/admin"):
            deps = packages[path].get("dependencies", {})
            self.assertIn("@echallan/theme", deps)
            self.assertIn("react", deps)
            self.assertIn("react-dom", deps)
        tablet_deps = {**packages["apps/tablet"].get("dependencies", {}),
                       **packages["apps/tablet"].get("devDependencies", {})}
        self.assertFalse(any(name.startswith(("@mui/x-data-grid", "@mui/x-charts", "@mui/x-date-pickers"))
                             for name in tablet_deps))
        self.assertIn("fastify", packages["apps/api"].get("dependencies", {}))
        self.assertIn("zod", packages["packages/contracts"].get("dependencies", {}))
        self.assertIn("@mui/material", packages["packages/theme"].get("dependencies", {}))

    def test_explicit_environment_and_setup_documentation(self):
        example = ROOT / ".env.example"
        self.assertTrue(example.is_file(), "SET-01: missing root env example")
        text = example.read_text()
        values = dict(re.findall(r"^([A-Z_]+)=(.*)$", text, re.MULTILINE))
        self.assertIn("DATABASE_URL", values)
        self.assertIn("TEST_DATABASE_URL", values)
        self.assertNotEqual(values["DATABASE_URL"], values["TEST_DATABASE_URL"])
        self.assertRegex(values["TEST_DATABASE_URL"], r"_test(?:[?\s]|$)")
        self.assertIn("PORT", values)
        self.assertIn("API_ORIGIN", values)
        readme = ROOT / "README.md"
        self.assertTrue(readme.is_file(), "Document exact runnable setup commands")
        readme_text = readme.read_text()
        for command in ("pnpm install", "pnpm db:up", "pnpm db:migrate", "pnpm test:integration", "pnpm test:e2e"):
            self.assertIn(command, readme_text)
        self.assertIn("playwright", readme_text.lower())
        self.assertIn("TEST_DATABASE_URL", readme_text)

    def test_ci_declares_gate_execution(self):
        workflow_dir = ROOT / ".github/workflows"
        workflows = list(workflow_dir.glob("*.yml")) + list(workflow_dir.glob("*.yaml"))
        self.assertTrue(workflows, "SET-04: missing CI workflows")
        text = "\n".join(line for path in workflows for line in path.read_text().splitlines()
                         if not line.lstrip().startswith("#"))
        run_lines = []
        block_indent = None
        for line in text.splitlines():
            indent = len(line) - len(line.lstrip())
            if block_indent is not None:
                if line.strip() and indent <= block_indent:
                    block_indent = None
                else:
                    run_lines.append(line)
                    continue
            match = re.match(r"\s*(?:-\s+)?run:\s*(.*)", line)
            if match:
                if match.group(1).strip() in ("|", ">", "|-", ">-"):
                    block_indent = indent
                else:
                    run_lines.append(match.group(1))
        commands = "\n".join(run_lines)
        for command in ("format:check", "lint", "typecheck", "test:integration", "test:e2e",
                        "test:foundation", "build", "check:tablet-size"):
            self.assertRegex(commands, rf"pnpm\s+(?:run\s+)?{re.escape(command)}\b",
                             f"CI run steps must declare {command}")
        self.assertRegex(commands, r"pnpm\s+(?:run\s+)?test(?:\s|$|[;&])", "CI must run unit tests")
        self.assertIn("postgres", text.lower())
        self.assertIn("frozen-lockfile", text)
        self.assertNotRegex(text, r"continue-on-error:\s*true")


if __name__ == "__main__":
    unittest.main()
