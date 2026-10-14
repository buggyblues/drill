# Recap UI in Drill

Vendored from `/Users/ryanbzhou/Downloads/recap-design-system` version 0.1.0, under the original MIT license. This workspace contains the reusable React components, domain utilities, CSS and source tokens. Demo data, preview HTML, Storybook and example persistence are not part of the application.

Import components from `@recap/ui` and include `@recap/ui/styles.css` once from the host stylesheet. Wrap the application in `RecapProvider`; its separate portal container carries theme and density to dialogs, selects and popovers.

Local integration adjustments:

- Import React in `icons.tsx` for Drill's classic JSX compiler.
- Keep stylesheet loading explicit so the host can order CSS layers before the library. The source entry's RSC directive is omitted for the Vite/Electron client application.
- Export TypeScript source through a local npm workspace instead of requiring a separately published library build.

Drill keeps its own knowledge-object types, persistence, paragraph editor and canvas. It uses Recap navigation, layout, forms, overlays and settings through controlled callbacks; library demo objects are never written into the Drill repository.

Installed runtime dependencies and versions are recorded in the root `package-lock.json`. Original copyright notices are retained in `LICENSE` and `THIRD_PARTY_NOTICES.md`.
