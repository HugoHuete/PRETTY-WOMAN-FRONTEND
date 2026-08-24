# Repository Guidelines

## Project Structure & Module Organization

This repository contains product documentation and framework-free UI prototypes for the Pretty Woman administrative application.

- `docs/prototypes/`: runnable HTML screens with page-specific CSS and JavaScript (for example, `sale-detail.html`, `sale-detail.css`, and `sale-detail.js`).
- `docs/wireframes/`: early layout explorations and shared wireframe styling.
- `docs/design/`: visual direction, tokens, responsive rules, and accessibility expectations.
- `docs/product/`: screen maps, roles, workflows, and backend-integration requirements.
- `assets/brand/` and `assets/catalog/`: logos and sample product imagery.
- `PRODUCT.md`: product purpose, users, and design principles.

Keep related prototype files together and reuse `prototype-shell.js` and `prototype-icons.svg` when extending the shared shell.

## Build, Test, and Development Commands

There is no package manifest or build step yet. Serve the repository over HTTP so relative asset paths behave consistently:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173/docs/prototypes/login.html`. Stop the server with `Ctrl+C`. Before submitting changes, inspect `git diff --check` for whitespace errors and `git diff` for unintended edits.

## Coding Style & Naming Conventions

Use two-space indentation in readable HTML, CSS, and JavaScript. Name files and CSS classes in kebab-case (`purchase-order-receipt.css`), JavaScript variables and functions in camelCase (`updateSummary`), and constants descriptively. Prefer `const`, use `let` only for reassignment, and terminate statements with semicolons. Preserve Spanish UI copy and semantic HTML. Maintain visible focus states, explicit labels, adequate touch targets, and text or icons alongside color-coded statuses.

## Testing Guidelines

No automated test framework or coverage threshold is configured. Manually exercise each changed prototype at desktop and tablet widths. Verify primary flows, validation, dialogs, empty/error states, keyboard navigation, and browser-console output. Confirm links, images, and sibling CSS/JS files load through the local server. Document tested pages and scenarios in the pull request.

## Commit & Pull Request Guidelines

The repository currently has no commits, so no historical convention exists. Use short, imperative, scoped messages such as `Add purchase receipt validation` or `Refine tablet sales layout`. Keep commits focused. Pull requests should explain the user-facing change, list tested routes and viewport sizes, link the relevant issue or product requirement, and include before/after screenshots for visual changes. Call out any intentional divergence from `PRODUCT.md` or `docs/product/admin-screen-map.md`.
