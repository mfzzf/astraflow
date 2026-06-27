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
- Keep control widths content-aware. Avoid fixed or minimum widths that leave obvious empty space; use max-width only when needed to prevent overflow.
- Use compact inline controls for dashboard filters. Search icons inside inputs should be small, around 16px, and visually secondary.
- Put summary counts such as `4 active · 4 total` after search and filter controls when those controls are present.
- Center table headers and center table body content for management tables unless a column needs a deliberate exception for readability.
- For table cells containing nested flex layouts, center the nested content too so it aligns with centered headers.
- Choose chart types by data semantics: area charts for time trends, bar charts for ranked comparisons, and pie/donut charts for small part-to-whole breakdowns.
- Do not add decorative color strips or accents to KPI cards unless they encode data. Keep color primarily in charts and status indicators.
