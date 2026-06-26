<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Local Workflow

- Do not run compile/build commands such as `bun run build` unless the user explicitly asks for a build.
- Use `bun run lint` as the default verification command.
- Do not start the dev server unless the user explicitly asks for it.

## Product UI Conventions

- Spell the product area as `Modelverse`, not `ModelVerse`.
- If the route header already shows the page title, do not repeat the same page title in the page body.
