### UI Features and Enhancements Proposal

This document proposes pragmatic, high-leverage improvements to the frontend, aligned with the existing React + TypeScript app and components in `frontend/src/components` and `frontend/src/components/ui`.

### Goals
- **Improve flow**: Faster from question to trusted answer.
- **Increase transparency**: Show sources, tool runs, and reasoning signals.
- **Boost productivity**: Shortcuts, re-run tools, saved queries.
- **Polish UX**: Accessibility, resilience, and consistent design.

### Now — high impact, low complexity (S/M)
- **Loading and optimistic UX** (S): Use `Skeleton` and optimistic inserts in `ChatContainer`/`ChatMessage` while awaiting responses.
  - Scope: Add request-in-flight state, show token/stream indicator if supported.
  - Files: `frontend/src/components/chat/*`, `frontend/src/components/ui/skeleton.tsx`.
- **Error toasts + retry** (S): Standardize error surfacing with `Toast`, include quick Retry on failure.
  - Files: `frontend/src/components/ui/toast.tsx`, `frontend/src/hooks/api.ts`.
- **Copy actions** (S): Copy message text and code blocks from `ChatMessage`.
  - Files: `frontend/src/components/chat/ChatMessage.tsx`.
- **Keyboard shortcuts v1** (S/M): Enter=send, Shift+Enter=newline, Cmd/Ctrl+K=command palette stub.
  - Files: `frontend/src/components/chat/ChatInput.tsx`, global listener in `App.tsx`.
- **Persist draft per channel** (S): LocalStorage-backed draft in `ChatInput` keyed by selected channel.
  - Files: `frontend/src/components/chat/ChatInput.tsx`, `frontend/src/hooks/chat.ts`.
- **Channel quick filter** (S/M): Inline search on `ChannelSelector` with debounced input; fuzzy match.
  - Files: `frontend/src/components/ChannelSelector.tsx`.
- **Theme toggle (light/dark)** (M): Toggle in header; use CSS variables to avoid large refactors.
  - Files: `frontend/src/App.tsx`, `frontend/src/index.css`, `frontend/src/app.css`.

### Next — medium scope features (M)
- **Citations and sources** (M): Show linked Slack messages/files below each response.
  - UI: Collapsible “Sources” section; open Slack permalink in new tab.
  - Files: `frontend/src/components/ResponseDisplay.tsx`.
- **File previews** (M): Inline previews for images/PDFs referenced in responses.
  - Files: `frontend/src/components/ResponseDisplay.tsx`.
- **Feedback controls** (S/M): Thumbs up/down per response, send signal to backend.
  - Files: `frontend/src/components/ResponseDisplay.tsx`, `frontend/src/hooks/api.ts`.
- **Saved conversations / pinned answers** (M): Sidebar list of saved runs.
  - Files: `frontend/src/components/chat/ChatContainer.tsx` (layout), new `SavedRuns` component.
- **Settings modal** (M): Model/provider, temperature, tool toggles.
  - Files: `frontend/src/components/ui/dialog.tsx`, new `Settings.tsx`.
- **Advanced Metadata upgrades** (S/M): Collapsible JSON viewer, copy-as-JSON.
  - Files: `frontend/src/components/AdvancedMetadata.tsx`.

### Later — larger initiatives (M/L)
- **Threaded conversations** (M/L): Slack-like side panel for threads; support follow-ups scoped to a thread.
  - Files: `frontend/src/components/chat/ChatContainer.tsx`, new `ThreadPanel.tsx`.
- **Tool run timeline** (L): Visual timeline of tool calls (Slack searches, file fetches), with durations/status.
  - Files: new `ToolTimeline.tsx`, integrate into `ResponseDisplay` or a `Debug` drawer.
- **Multi-agent compare** (L): Run the same query across agents; side-by-side responses and diff.
  - Files: new `AgentSelector.tsx`, `CompareView.tsx`.
- **Command palette** (M/L): Quick actions (new chat, switch channel, last queries).
  - Files: new `CommandPalette.tsx` (opened via Cmd/Ctrl+K).
- **Share/export** (M): Export chat as Markdown/JSON; shareable permalink (URL state).
  - Files: `frontend/src/components/chat/ChatContainer.tsx`, router integration if present.
- **Real-time streaming** (M/L): Stream tokens/events via SSE/WebSocket.
  - Files: `frontend/src/hooks/chat.ts`, `frontend/src/lib/api.ts`.
- **Internationalization** (M/L): i18n scaffold; externalize copy.
  - Files: introduce `i18n.ts`, wrap text in translation hooks.

### UX and Design System polish
- **Consistent primitives**: Extend `ui/` with `tooltip`, `alert`, `badge` usages across app.
- **Empty states**: Purposeful empty content for first-run, no results, and errors.
- **Accessibility**: Focus traps in dialogs, ARIA labels for buttons, color contrast.
- **Theming**: CSS variables for foreground/background; respects OS scheme.

### Performance safeguards
- **Virtualize long chats**: Use list virtualization for `ChatMessage` list.
- **Cache and prefetch**: `react-query` prefetch channels and recent runs.
- **Debounce inputs**: Channel filter, query input; cancel in-flight queries on new input.
- **Asset optimization**: Lazy-load heavy components (preview viewers, timeline).

### Keyboard shortcuts (initial)
| Shortcut | Action |
|---|---|
| Enter | Send message |
| Shift+Enter | Newline in input |
| Cmd/Ctrl+K | Open command palette |
| Cmd/Ctrl+L | Focus query input |
| J / K | Navigate messages up/down |

### Observability and feedback
- **Client event log**: Non-PII action events (send, retry, copy, feedback) for UX metrics.
- **User feedback loop**: Capture free-text when thumbs-down is clicked.

### Acceptance heuristics per feature
- **Measurable**: Define success (e.g., time-to-first-answer, retry rate, copy usage).
- **Accessible**: Keyboard-accessible, screen-reader friendly.
- **Resilient**: Graceful failure with retry and clear messaging.

### Suggested implementation order
1) Loading/optimistic UX, error toasts, copy actions, draft persistence.
2) Keyboard shortcuts v1, channel quick filter, theme toggle.
3) Citations, file previews, feedback controls, settings modal.
4) Saved conversations, virtualization, command palette.
5) Threaded view, tool timeline, multi-agent compare, streaming.

### Notes on integration
- Reuse existing primitives in `frontend/src/components/ui/` and match current styling.
- Prefer functional components and hooks; extend `hooks/chat.ts` and `lib/query-client.ts` as needed.
- Keep state colocated; lift to context only when shared across multiple areas.


