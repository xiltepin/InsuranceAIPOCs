# Dual-Agent Handshake Loop

## Rule 1: The Blueprint Freeze
Whenever an issue requires changes across `backend/` or `rating-engine/`, **@architect** must act first.
- @architect reads `complete_integration_manual.md`.
- @architect writes or updates a local `docs/ARCHITECTURE.md` showing file modifications.
- @architect logs the architectural sign-off into `state.md` and changes `Active System Process` to `DEVELOPER_READY`.

## Rule 2: The Implementation Execution
The **@developer** remains completely idle until `Active System Process` matches `DEVELOPER_READY`.
- @developer consumes the file schemas created by @architect.
- @developer modifies the active code base inside `backend/`, `frontend/`, or `rating-engine/`.
- If compiling or structural runtime execution paths fail, @developer rolls changes back and re-assigns the controller lock back to @architect.
