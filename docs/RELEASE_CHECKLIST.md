# Developer-preview release checklist

Tick every item before tagging a developer-preview release. Do not publish a release without maintainer approval.

## Quality
- [ ] `npm ci` succeeds on a clean checkout
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] Manual smoke test in the browser: drag and drop, connect, edit in the Inspector, run and stop the simulation, export JSON, import JSON, generate and download the project, refresh the page and confirm the project is restored
- [ ] Generated project spot-checked: `python simulator/simulator.py` runs (and `docker compose up --build` if Docker is available)

## Repository hygiene
- [ ] No secrets, tokens or `.env` files committed (`git log -p | grep -i -E "token|secret|password"` finds nothing real)
- [ ] No backup or temporary files tracked (`git ls-files | grep -E "\.bak$|backup"` prints nothing)
- [ ] `npm audit` reviewed; known issues noted in the release notes
- [ ] License chosen by the maintainer and `LICENSE` file added

## Documentation
- [ ] README matches the actual features and limitations
- [ ] CHANGELOG updated, version bumped in `package.json`
- [ ] No claims of production readiness, hardware support, partnerships or adoption

## Release
- [ ] Release notes say "Early-stage developer preview"
- [ ] Tag created from a green `main`
