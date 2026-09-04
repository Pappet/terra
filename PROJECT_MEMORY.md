# Persistent Project Memory

> Maintained by dsh-memoir: a cross-session record of completed work, lessons learned, and follow-up actions.
> This human-readable projection guides future agents; it is not injected into the system prompt in full.
> New sessions receive only bounded Hot Memory. Use memoir_read to retrieve complete history on demand.

## Lessons Learned

- [2026-09-04 22:24] [Lessons Learned] npm braucht Workspace-lokalen Cache — TERRA-Projekt (/home/peter/Projekte/WebSim): npm install scheitert mit EROFS, wenn npm den Standard-Cache /home/peter/.npm nutzt (Sandbox). Lösung: `npm install --cache ./.npm-cache` (Workspace-lokaler Cache, in .gitignore). Geschwindigkeit-Zerlegung: kleine Tasks, ein Commit pro Task, Format "M<n>: <Task>".
