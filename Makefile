.PHONY: dev backend frontend

_load_env = export $$(cat $(1) 2>/dev/null | xargs -0) && \
	if command -v grep >/dev/null 2>&1; then \
		export GEMINI_API_KEY=$$(grep -E '^GEMINI_API_KEY=' $(1) 2>/dev/null | cut -d '=' -f2-); \
	fi &&
	bl echo "Using GEMINI_API_KEY=$${GEMINI_API_KEY:-<not set>}"

backend:
	@bash -lc '$(call _load_env,backend/.env.local) source backend/.venv/bin/activate && GEMINI_API_KEY="$$GEMINI_API_KEY" python -m uvicorn app.main:app --reload'

frontend:
	@bash -lc 'cd front/new && pnpm dev'

dev:
	@bash -lc 'trap "kill 0" EXIT; \
		($(call _load_env,backend/.env.local) source backend/.venv/bin/activate && GEMINI_API_KEY="$$GEMINI_API_KEY" python -m uvicorn app.main:app --reload) & \
		(cd front/new && pnpm dev) & \
		wait'
	