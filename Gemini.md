# Gemini CI/CD & Seeding Guideline

## 🛠 Seeding (Produktion)
Ab sofort müssen alle Seedings für die Produktionsumgebung (VM) ausschließlich über den GitHub Workflow **"Seed Database"** durchgeführt werden. 

### Vorgehensweise:
1.  **Daten vorbereiten**: Die aktuellen Daten liegen lokal in `seed_users.json` und `seed_plan.json` (diese werden nicht in Git gepusht).
2.  **GitHub Actions**: 
    - Gehe zu **Actions > Seed Database**.
    - Klicke auf **Run workflow**.
3.  **Modus wählen**:
    - **merge (Standard)**: Aktualisiert bestehende Einträge und fügt neue hinzu. Vorhandene Daten bleiben erhalten.
    - **replace**: Löscht die entsprechenden Kollektionen (Nutzer/Plan) komplett und setzt sie auf den Stand der JSON-Daten zurück.

**Technischer Hinweis**: Das Script wird automatisch innerhalb des Docker-Containers `efg_nsu_portal` ausgeführt.

### Wichtig:
- Änderungen am Dienstplan-JSON sollten direkt in der GitHub Action Variable `SEED_PLAN_JSON` vorgenommen werden.
- Änderungen an der Mitgliederliste erfolgen über das GitHub Action Secret `SEED_USERS_JSON`.
- Niemals sensible Daten direkt in den Source-Code committen.

## 🚀 Deployment & Monitoring
Die Website wird automatisch bei jedem Push auf `main` aktualisiert. 

### Versionierung
Es wird striktes **Semantic Versioning (SemVer)** angewendet: `Major.Minor.Patch` (z.B. 1.1.0).
- **Major**: Bahnbrechende Änderungen oder kompletter Rewrite.
- **Minor**: Neue Features, die für den Endnutzer sichtbar sind (z.B. neue Seiten, neue Buttons).
- **Patch**: Fehlerbehebungen (Fixes), die das Nutzererlebnis verbessern.

**Wichtig:** Rein technische Änderungen im Hintergrund (CI/CD Anpassungen, Refactoring ohne UI-Änderung, Dokumentations-Updates) führen **nicht** zu einer neuen Version. Die Version in der `package.json` wird nur bei benutzerrelevanten Änderungen hochgesetzt. Bei großen Meilensteinen oder Feature-Releases (Minor oder Major) muss zusätzlich ein **Git-Tag** (z.B. `git tag -a v1.1.0 -m "Release v1.1.0"`) erstellt und gepusht werden.

### Robust Verification System
Anstatt nur auf Log-Strings zu prüfen, nutzt die Pipeline jetzt einen echten **Health-Check**:
1.  **Backend**: Ein Endpoint `/api/health` prüft die DB-Verbindung (kritisch) und den Bot-Status (informativ).
2.  **Docker**: In der `docker-compose.yml` ist ein `healthcheck` definiert, der diesen Endpoint regelmäßig abfragt.
3.  **Pipeline**: Die GitHub Action wartet, bis der Container den Status `healthy` meldet.

**Hinweis**: Der Status gilt als `healthy`, sobald die Datenbank verbunden ist. Der WhatsApp-Bot Status beeinflusst die Pipeline nicht (da dieser oft erst nach dem Start manuell gekoppelt wird).

## 🎨 Frontend Development Guidelines
### UI Library & Shadcn Context
**Wichtig:** Für alle UI-Komponenten muss die `shadcn/ui` Bibliothek verwendet werden. Alle Infos dazu: https://ui.shadcn.com/llms.txt
shadcn/ui is a collection of beautifully-designed, accessible components and a code distribution platform. It is built with TypeScript, Tailwind CSS, and Radix UI primitives. It supports multiple frameworks including Next.js, Vite, Remix, Astro, and more. Open Source. Open Code. AI-Ready. It also comes with a command-line tool to install and manage components and a registry system to publish and distribute code.

## Overview

- [Introduction](https://ui.shadcn.com/docs): Core principles—Open Code, Composition, Distribution, Beautiful Defaults, and AI-Ready design.
- [CLI](https://ui.shadcn.com/docs/cli): Command-line tool for installing and managing components.
- [components.json](https://ui.shadcn.com/docs/components-json): Configuration file for customizing the CLI and component installation.
- [Theming](https://ui.shadcn.com/docs/theming): Guide to customizing colors, typography, and design tokens.
- [Changelog](https://ui.shadcn.com/docs/changelog): Release notes and version history.
- [About](https://ui.shadcn.com/docs/about): Credits and project information.

## Installation

- [Next.js](https://ui.shadcn.com/docs/installation/next): Install shadcn/ui in a Next.js project.
- [Vite](https://ui.shadcn.com/docs/installation/vite): Install shadcn/ui in a Vite project.
- [Remix](https://ui.shadcn.com/docs/installation/remix): Install shadcn/ui in a Remix project.
- [Astro](https://ui.shadcn.com/docs/installation/astro): Install shadcn/ui in an Astro project.
- [Laravel](https://ui.shadcn.com/docs/installation/laravel): Install shadcn/ui in a Laravel project.
- [Gatsby](https://ui.shadcn.com/docs/installation/gatsby): Install shadcn/ui in a Gatsby project.
- [React Router](https://ui.shadcn.com/docs/installation/react-router): Install shadcn/ui in a React Router project.
- [TanStack Router](https://ui.shadcn.com/docs/installation/tanstack-router): Install shadcn/ui in a TanStack Router project.
- [TanStack Start](https://ui.shadcn.com/docs/installation/tanstack): Install shadcn/ui in a TanStack Start project.
- [Manual Installation](https://ui.shadcn.com/docs/installation/manual): Manually install shadcn/ui without the CLI.

## Components

### Form & Input

- [Form](https://ui.shadcn.com/docs/components/form): Building forms with React Hook Form and Zod validation.
- [Field](https://ui.shadcn.com/docs/components/field): Field component for form inputs with labels and error messages.
- [Button](https://ui.shadcn.com/docs/components/button): Button component with multiple variants.
- [Button Group](https://ui.shadcn.com/docs/components/button-group): Group multiple buttons together.
- [Input](https://ui.shadcn.com/docs/components/input): Text input component.
- [Input Group](https://ui.shadcn.com/docs/components/input-group): Input component with prefix and suffix addons.
- [Input OTP](https://ui.shadcn.com/docs/components/input-otp): One-time password input component.
- [Textarea](https://ui.shadcn.com/docs/components/textarea): Multi-line text input component.
- [Checkbox](https://ui.shadcn.com/docs/components/checkbox): Checkbox input component.
- [Radio Group](https://ui.shadcn.com/docs/components/radio-group): Radio button group component.
- [Select](https://ui.shadcn.com/docs/components/select): Select dropdown component.
- [Switch](https://ui.shadcn.com/docs/components/switch): Toggle switch component.
- [Slider](https://ui.shadcn.com/docs/components/slider): Slider input component.
- [Calendar](https://ui.shadcn.com/docs/components/calendar): Calendar component for date selection.
- [Date Picker](https://ui.shadcn.com/docs/components/date-picker): Date picker component combining input and calendar.
- [Combobox](https://ui.shadcn.com/docs/components/combobox): Searchable select component with autocomplete.
- [Label](https://ui.shadcn.com/docs/components/label): Form label component.

### Layout & Navigation

- [Accordion](https://ui.shadcn.com/docs/components/accordion): Collapsible accordion component.
- [Breadcrumb](https://ui.shadcn.com/docs/components/breadcrumb): Breadcrumb navigation component.
- [Navigation Menu](https://ui.shadcn.com/docs/components/navigation-menu): Accessible navigation menu with dropdowns.
- [Sidebar](https://ui.shadcn.com/docs/components/sidebar): Collapsible sidebar component for app layouts.
- [Tabs](https://ui.shadcn.com/docs/components/tabs): Tabbed interface component.
- [Separator](https://ui.shadcn.com/docs/components/separator): Visual divider between content sections.
- [Scroll Area](https://ui.shadcn.com/docs/components/scroll-area): Custom scrollable area with styled scrollbars.
- [Resizable](https://ui.shadcn.com/docs/components/resizable): Resizable panel layout component.

### Overlays & Dialogs

- [Dialog](https://ui.shadcn.com/docs/components/dialog): Modal dialog component.
- [Alert Dialog](https://ui.shadcn.com/docs/components/alert-dialog): Alert dialog for confirmation prompts.
- [Sheet](https://ui.shadcn.com/docs/components/sheet): Slide-out panel component (drawer).
- [Drawer](https://ui.shadcn.com/docs/components/drawer): Mobile-friendly drawer component using Vaul.
- [Popover](https://ui.shadcn.com/docs/components/popover): Floating popover component.
- [Tooltip](https://ui.shadcn.com/docs/components/tooltip): Tooltip component for additional context.
- [Hover Card](https://ui.shadcn.com/docs/components/hover-card): Card that appears on hover.
- [Context Menu](https://ui.shadcn.com/docs/components/context-menu): Right-click context menu.
- [Dropdown Menu](https://ui.shadcn.com/docs/components/dropdown-menu): Dropdown menu component.
- [Menubar](https://ui.shadcn.com/docs/components/menubar): Horizontal menubar component.
- [Command](https://ui.shadcn.com/docs/components/command): Command palette component (cmdk).

### Feedback & Status

- [Alert](https://ui.shadcn.com/docs/components/alert): Alert component for messages and notifications.
- [Toast](https://ui.shadcn.com/docs/components/toast): Toast notification component using Sonner.
- [Progress](https://ui.shadcn.com/docs/components/progress): Progress bar component.
- [Spinner](https://ui.shadcn.com/docs/components/spinner): Loading spinner component.
- [Skeleton](https://ui.shadcn.com/docs/components/skeleton): Skeleton loading placeholder.
- [Badge](https://ui.shadcn.com/docs/components/badge): Badge component for labels and status indicators.
- [Empty](https://ui.shadcn.com/docs/components/empty): Empty state component for no data scenarios.

### Display & Media

- [Avatar](https://ui.shadcn.com/docs/components/avatar): Avatar component for user profiles.
- [Card](https://ui.shadcn.com/docs/components/card): Card container component.
- [Table](https://ui.shadcn.com/docs/components/table): Table component for displaying data.
- [Data Table](https://ui.shadcn.com/docs/components/data-table): Advanced data table with sorting, filtering, and pagination.
- [Chart](https://ui.shadcn.com/docs/components/chart): Chart components using Recharts.
- [Carousel](https://ui.shadcn.com/docs/components/carousel): Carousel component using Embla Carousel.
- [Aspect Ratio](https://ui.shadcn.com/docs/components/aspect-ratio): Container that maintains aspect ratio.
- [Typography](https://ui.shadcn.com/docs/components/typography): Typography styles and components.
- [Item](https://ui.shadcn.com/docs/components/item): Generic item component for lists and menus.
- [Kbd](https://ui.shadcn.com/docs/components/kbd): Keyboard shortcut display component.

### Misc

- [Collapsible](https://ui.shadcn.com/docs/components/collapsible): Collapsible container component.
- [Toggle](https://ui.shadcn.com/docs/components/toggle): Toggle button component.
- [Toggle Group](https://ui.shadcn.com/docs/components/toggle-group): Group of toggle buttons.
- [Pagination](https://ui.shadcn.com/docs/components/pagination): Pagination component for lists and tables.

## Dark Mode

- [Dark Mode](https://ui.shadcn.com/docs/dark-mode): Overview of dark mode implementation.
- [Dark Mode - Next.js](https://ui.shadcn.com/docs/dark-mode/next): Dark mode setup for Next.js.
- [Dark Mode - Vite](https://ui.shadcn.com/docs/dark-mode/vite): Dark mode setup for Vite.
- [Dark Mode - Astro](https://ui.shadcn.com/docs/dark-mode/astro): Dark mode setup for Astro.
- [Dark Mode - Remix](https://ui.shadcn.com/docs/dark-mode/remix): Dark mode setup for Remix.

## Forms

- [Forms Overview](https://ui.shadcn.com/docs/forms): Guide to building forms with shadcn/ui.
- [React Hook Form](https://ui.shadcn.com/docs/forms/react-hook-form): Using shadcn/ui with React Hook Form.
- [TanStack Form](https://ui.shadcn.com/docs/forms/tanstack-form): Using shadcn/ui with TanStack Form.
- [Forms - Next.js](https://ui.shadcn.com/docs/forms/next): Building forms in Next.js with Server Actions.

## Advanced

- [Monorepo](https://ui.shadcn.com/docs/monorepo): Using shadcn/ui in a monorepo setup.
- [React 19](https://ui.shadcn.com/docs/react-19): React 19 support and migration guide.
- [Tailwind CSS v4](https://ui.shadcn.com/docs/tailwind-v4): Tailwind CSS v4 support and setup.
- [JavaScript](https://ui.shadcn.com/docs/javascript): Using shadcn/ui with JavaScript (no TypeScript).
- [Figma](https://ui.shadcn.com/docs/figma): Figma design resources.
- [v0](https://ui.shadcn.com/docs/v0): Generating UI with v0 by Vercel.

## MCP Server

- [MCP Server](https://ui.shadcn.com/docs/mcp): Model Context Protocol server for AI integrations. Allows AI assistants to browse, search, and install components from registries using natural language. Works with Claude Code, Cursor, VS Code (GitHub Copilot), Codex and more.

## Registry

- [Registry Overview](https://ui.shadcn.com/docs/registry): Creating and publishing your own component registry.
- [Getting Started](https://ui.shadcn.com/docs/registry/getting-started): Set up your own registry.
- [Examples](https://ui.shadcn.com/docs/registry/examples): Example registries.
- [FAQ](https://ui.shadcn.com/docs/registry/faq): Common questions about registries.
- [Authentication](https://ui.shadcn.com/docs/registry/authentication): Adding authentication to your registry.
- [Registry MCP](https://ui.shadcn.com/docs/registry/mcp): MCP integration for registries.

### Registry Schemas

- [Registry Schema](https://ui.shadcn.com/schema/registry.json): JSON Schema for registry index files. Defines the structure for a collection of components, hooks, pages, etc. Requires name, homepage, and items array.
- [Registry Item Schema](https://ui.shadcn.com/schema/registry-item.json): JSON Schema for individual registry items. Defines components, hooks, themes, and other distributable code with properties for dependencies, files, Tailwind config, CSS variables, and more

**Core Principles:**
- **Open Code:** Copy and paste components into your apps.
- **Composition:** Components are built using Radix UI primitives and Tailwind CSS.
- **Theming:** Customizable colors, typography, and design tokens. Standard is the "Violet" theme.

**Structure:**
- Components live in `client/src/components/ui`.
- Global styles in `client/src/index.css`.
- Utils in `client/src/lib/utils.js` (cn helper).

**Usage:**
- Import components from `@/components/ui/...`.
- Use the `cn` utility for class merging.
- Prefer `lucide-react` for icons.

## 🛡️ Security & Stability Protocol (AI Mandate)
Jede Änderung am Code muss zwingend die folgenden Sicherheits- und Stabilitätsregeln befolgen:

1.  **Input Sanitization**: Behandle alle User-Inputs (Body, Query, Params) als potenziell bösartig. Caste IDs (`req.params.id`) immer explizit zu Strings, um NoSQL-Injection zu verhindern.
2.  **Zero-Secret Policy**: Niemals Secrets, Passwörter oder API-Keys in den Quellcode schreiben. Nutze ausschließlich Umgebungsvariablen (`process.env`).
3.  **Access Control**: Neue API-Routen müssen standardmäßig hinter `isAdmin` oder `authMiddleware` gesichert werden. Öffentliche Routen sind die absolute Ausnahme und müssen begründet werden.
4.  **Error Handling**: Sende niemals Stack-Traces oder technische Fehlermeldungen an den Client. Nutze den globalen Error-Handler für neutrale Meldungen in der Produktion.
5.  **Non-Blocking Startup**: Datenbankverbindungen dürfen den Start des HTTP-Servers nicht blockieren (kein Top-Level Await für DB-Connect), damit der Health-Check auch während Instabilitäten antworten kann.
6.  **Rate Limiting**: Neue sensitive Endpunkte (Auth, Registration, Forms) müssen zwingend mit einem `rateLimit` geschützt werden.
7.  **Safe Rendering**: Nutze keine unsicheren Rendering-Methoden (wie `dangerouslySetInnerHTML`), um XSS-Angriffe zu verhindern.
9.  **Passwordless First**: Das System nutzt ausschließlich WhatsApp-OTP zur Authentifizierung. Passwörter sind im Code und UI zu vermeiden.
10. **Smart User Matching**: Bei der Anmeldung ohne hinterlegte Nummer muss das System versuchen, den Nutzer anhand von Vor- und Nachname (case-insensitive) in der Bestandsdatenbank zu finden und zu verknüpfen, bevor ein Dubletten-Account erstellt wird.
11. **German Language First**: Sämtliche Texte, Labels, Fehlermeldungen und UI-Elemente, die für Endnutzer sichtbar sind, müssen zwingend in deutscher Sprache verfasst sein.

## 🧠 Senior Review & Pre-Commit Protocol (TDD MANDATE)
Vor jedem Commit muss die KI folgende Schritte durchführen:

1.  **Test-Driven Development (TDD) Orientation**: Jede Änderung muss zwingend von Tests begleitet werden. Vor der Implementierung (oder unmittelbar danach bei AI-Workflows) muss geprüft werden: Muss ein bestehender Unit- oder Integrationstest angepasst werden? Muss ein neuer Test erstellt werden, um das Feature/Fix abzusichern?
2.  **Senior Code Review**: Eine kritische Analyse auf Logikfehler, Architektur-Schwächen (DRY), Performance-Engpässe und Einhaltung von Best Practices.
3.  **Security Audit**: Abgleich mit dem oben genannten Sicherheitsprotokoll.
4.  **Local Build Check**: Ausführen von `npm run build` im Client-Ordner, um Syntax- und Paket-Fehler vor dem Push abzufangen.
5.  **Backend Syntax Check**: Prüfung der JS-Files mit `node --check`.
6.  **Automated Integration Tests**: Ausführen von `npm run test` im Client-Ordner. **Kein Commit ohne grüne Tests.** Playwright-Tests niemals mit HTML-Reporter ausführen (bleibt hängen), stattdessen immer `--reporter=list` oder `--reporter=json` verwenden.
7.  **Responsiveness Check**: Manuelle oder automatisierte Prüfung auf Layout-Overflows (X-Achse) und Bedienbarkeit auf kleinen Bildschirmen (Mobile-First).
8.  **Deletion Guard**: Explizite Prüfung des `git diff` auf versehentlich gelöschte Codeblöcke, Importe oder Exporte.

---

### 📝 TODO / Reminder für Domain-Umstellung
Sobald das Portal über eine echte Domain mit **HTTPS** erreichbar ist, muss die `helmet` Konfiguration in `src/index.js` wieder verschärft werden:
- `contentSecurityPolicy`: true
- `crossOriginOpenerPolicy`: true
- `crossOriginResourcePolicy`: true
- `strictTransportSecurity`: true (HSTS aktivieren)

