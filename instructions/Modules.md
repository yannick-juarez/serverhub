# ServerHub Module Compliance Blueprint

## 1) General Idea (Condensed)

The core idea is to evolve ServerHub from a fixed feature set into a stable core plus pluggable modules.

- The core owns security, auth, permissions, lifecycle orchestration, and extension points.
- Modules own business features and UI contributions.
- Modules must never bypass the core security model.
- Installation and execution must be validated, permission-scoped, and auditable.

In short: keep the core small and predictable, move feature growth into modules.

## 2) Adaptation to the Current ServerHub Project

Current observed state:

- Backend is organized by feature folders under `backend/src/modules/*`.
- API domains are manually wired in `backend/src/routes/index.ts`.
- Frontend routes are manually declared in `frontend/src/App.tsx`.
- Runtime data is persisted in `backend/storage/app-storage.json`.
- There is no formal plugin manifest, loader, lifecycle engine, or permissioned module SDK yet.

This is a good foundation because domain separation already exists. The next step is turning those domains into first-class loadable modules with contracts.

## 3) What “Module Compliant” Means for ServerHub

ServerHub is module compliant when all items below are true:

1. Every module has a validated manifest.
2. Every module follows lifecycle hooks: install, enable, disable, update, uninstall.
3. Module backend routes are registered through a controlled API, not direct app mutation.
4. Module frontend entries (pages/menu/widgets) are registered through a UI extension registry.
5. Module actions are enforced by granular capabilities and permissions.
6. Module install/update/uninstall operations are fully audited.
7. Third-party module packages are verified before execution.
8. Module compatibility and dependencies are resolved before activation.

## 4) Target Architecture

### 4.1 Core (stable, trusted)

- Auth and RBAC
- Capability registry and permission checks
- Module manager (discover, validate, install, enable, disable, update, uninstall)
- Manifest validator
- Event bus
- Module route registry
- Frontend extension registry API
- Audit logger
- Dependency and compatibility resolver

### 4.2 Module Runtime

- Module loading and sandbox boundary
- SDK context passed to modules
- Hook executor
- Error isolation and health status

### 4.3 Modules

Each module contains:

- manifest (`module.json`)
- backend entry (optional)
- frontend entry descriptor (optional)
- migrations (optional)
- static assets (optional)
- signature/checksum metadata (recommended)

## 5) Minimal Manifest for V1

```json
{
  "name": "monitoring-advanced",
  "displayName": "Monitoring Advanced",
  "version": "1.0.0",
  "description": "Extra charts and alerts for monitoring",
  "type": "system",
  "entry": {
    "backend": "backend/index.js",
    "frontend": "frontend/entry.json"
  },
  "compatibleWith": {
    "core": ">=1.0.0 <2.0.0"
  },
  "dependencies": {
    "database": "^1.0.0"
  },
  "permissions": [
    "monitoring.read",
    "notifications.write"
  ],
  "hooks": [
    "onInstall",
    "onEnable",
    "onDisable",
    "onUpdate",
    "onUninstall"
  ]
}
```

## 6) Module SDK Contract (Backend)

V1 SDK should expose controlled primitives only:

- `ctx.routes.register(basePath, router)`
- `ctx.events.on(eventName, handler)`
- `ctx.capabilities.use(capabilityName)`
- `ctx.storage.get/set(namespace, key, value)`
- `ctx.logger.info/warn/error(...)`
- `ctx.audit.record(action, details)`
- `ctx.config.get(...)`

Important rule:

- No raw shell execution API in V1 SDK.
- No unrestricted filesystem access in V1 SDK.

## 7) Frontend Extension Contract (V1)

Given current manual routes in `frontend/src/App.tsx`, introduce a registry-based model:

- module can register a page
- module can register navigation items
- module can register dashboard widgets

Example entry descriptor:

```json
{
  "pages": [
    {
      "id": "module.monitoring-advanced.overview",
      "path": "/modules/monitoring-advanced",
      "component": "MonitoringOverview"
    }
  ],
  "menu": [
    {
      "section": "Monitoring",
      "label": "Advanced",
      "path": "/modules/monitoring-advanced"
    }
  ]
}
```

## 8) Security and Isolation Requirements

For a server administration product, this is mandatory:

- Validate zip extraction against path traversal.
- Validate manifest schema before any execution.
- Enforce compatibility and dependency checks before enable.
- Enforce least-privilege permissions.
- Write audit logs for all module lifecycle and sensitive actions.
- Fail closed: invalid module must not load.

Isolation levels roadmap:

- V1: same process + strict SDK boundary and permission checks.
- V2: worker process isolation for backend modules.
- V3: container sandbox for untrusted third-party modules.

## 9) Installation Flow (Secure)

1. Upload package.
2. Extract to temporary directory.
3. Validate manifest schema.
4. Verify signature/checksum.
5. Run static safety checks.
6. Verify core compatibility.
7. Resolve module dependencies.
8. Install under module store.
9. Execute `onInstall`.
10. Mark installed and optionally enable.
11. Execute `onEnable` if enabled.
12. Record audit trail.

## 10) ServerHub Implementation Plan

### Phase 1: Contracts and Registry

- Add module domain in backend: `backend/src/modules/module-runtime/*`.
- Add manifest schema and validator.
- Add persistent module state in storage (installed/enabled/version).
- Add module manager service with lifecycle transitions.

### Phase 2: Backend Runtime Integration

- Replace hardcoded domain route wiring with registry composition.
- Keep existing built-in domains as internal modules (auth, monitoring, db, files, etc.).
- Add event bus and capability gate.

### Phase 3: Frontend Runtime Integration

- Replace static module-like pages with registry-fed route/menu composition.
- Add module page host under `/modules/:moduleId/*`.
- Add module management UI (install/enable/disable/update/uninstall).

### Phase 4: Secure Package Installer

- Add upload + temp extraction + validation pipeline.
- Add signature verification and dependency resolution.
- Add rollback behavior on failed install/update.

### Phase 5: Isolation Hardening

- Move third-party backend modules to separate processes.
- Add health checks, restart policy, and resource limits.

## 11) Data Model to Add (V1)

Persist module metadata in storage (or future DB):

- `module_id`
- `name`
- `version`
- `status` (`installed`, `enabled`, `disabled`, `error`)
- `installed_at`
- `updated_at`
- `permissions_granted`
- `compatibility_result`
- `last_error`

## 12) Suggested Event Names (V1)

- `module.installed`
- `module.enabled`
- `module.disabled`
- `module.updated`
- `module.uninstalled`
- `user.logged_in`
- `database.connection.created`
- `database.connection.deleted`
- `files.operation.completed`

## 13) Practical Definition of Done

ServerHub can be declared module compliant when:

1. At least one feature is delivered as an external module package.
2. Lifecycle hooks are executed and tested.
3. Permission checks block unauthorized module actions.
4. Module UI is injected through registry, not hardcoded route edits.
5. Install/update/uninstall paths are auditable and recoverable.
6. Invalid manifests and incompatible versions are rejected automatically.

## 14) Recommended Scope for First Release

Build a narrow but complete V1:

- signed local package install
- manifest validation
- lifecycle engine
- permission gate
- backend route registration
- frontend page/menu registration
- audit logs

Then expand to registry, auto-updates, and stronger isolation.
