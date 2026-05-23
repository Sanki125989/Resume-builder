#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# run-resume-upload.sh
# Automates: Login Naukri → scrape recommended job → update resume → upload
# Scheduled via cron: 59 23 * * * (23:59 IST daily)
# System timezone: Asia/Kolkata — cron time is already IST
# ──────────────────────────────────────────────────────────────────────────────

# ── Paths ──────────────────────────────────────────────────────────────────────
WORKSPACE="/home/sanket/Documents/Personal documents/Resume-builder"
BACKEND_DIR="$WORKSPACE/resume-builder/backend"
PUPPETEER_DIR="$WORKSPACE/resume-builder/puppeteer-service"
ENV_FILE="$WORKSPACE/.env"
LOGFILE="$HOME/.resume-upload.log"

# Full paths for commands (cron runs with minimal PATH, nvm not loaded)
NODE="/home/sanket/.nvm/versions/node/v24.4.0/bin/node"
NPM="/home/sanket/.nvm/versions/node/v24.4.0/bin/npm"
MVN="/usr/bin/mvn"
CURL="/usr/bin/curl"

# ── Logging helper ─────────────────────────────────────────────────────────────
log() {
    echo "[$(date '+%d-%m-%Y %H:%M:%S')] $*" | tee -a "$LOGFILE"
}

log "════════════════════════════════════════════════════════"
log "Resume Upload Job STARTED"

# ── Load credentials ───────────────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
    log "ERROR: .env not found at $ENV_FILE"
    exit 1
fi
# shellcheck source=/dev/null
source "$ENV_FILE"

if [[ -z "${NAUKRI_EMAIL:-}" ]] || [[ -z "${NAUKRI_PASSWORD:-}" ]]; then
    log "ERROR: NAUKRI_EMAIL or NAUKRI_PASSWORD not set in .env"
    exit 1
fi

# ── Start Puppeteer service (port 3001) if not running ────────────────────────
if $CURL -sf http://localhost:3001/health >/dev/null 2>&1; then
    log "Puppeteer service already running on :3001"
else
    log "Starting Puppeteer service..."

    # Build dist/index.js if it doesn't exist yet
    if [[ ! -f "$PUPPETEER_DIR/dist/index.js" ]]; then
        log "  Building Puppeteer service (first run)..."
        cd "$PUPPETEER_DIR" && "$NPM" run build >> "$LOGFILE" 2>&1
    fi

    cd "$PUPPETEER_DIR" && "$NODE" dist/index.js >> "$LOGFILE" 2>&1 &
    PUPPETEER_PID=$!
    log "  Puppeteer service started (PID $PUPPETEER_PID)"

    # Wait up to 15s for it to be ready
    for i in $(seq 1 3); do
        sleep 5
        if $CURL -sf http://localhost:3001/health >/dev/null 2>&1; then
            log "  Puppeteer service ready"
            break
        fi
    done
fi

# ── Start Spring Boot backend (port 8085) if not running ─────────────────────
if $CURL -sf http://localhost:8085 >/dev/null 2>&1; then
    log "Backend already running on :8085"
else
    log "Starting Spring Boot backend (this takes ~60s)..."
    cd "$BACKEND_DIR" && "$MVN" spring-boot:run >> "$LOGFILE" 2>&1 &
    BACKEND_PID=$!
    log "  Backend started (PID $BACKEND_PID)"

    # Wait up to 120s for backend to respond
    READY=0
    for i in $(seq 1 24); do
        sleep 5
        if $CURL -sf http://localhost:8085 >/dev/null 2>&1; then
            READY=1
            log "  Backend ready after $((i * 5))s"
            break
        fi
        log "  ...waiting for backend ($((i * 5))s elapsed)"
    done

    if [[ $READY -eq 0 ]]; then
        log "ERROR: Backend did not start within 120s — aborting"
        exit 1
    fi
fi

# ── Call the API ───────────────────────────────────────────────────────────────
log "Calling POST /api/login-and-upload-resume ..."

RESPONSE=$($CURL -s -X POST "http://localhost:8085/api/login-and-upload-resume" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$NAUKRI_EMAIL\",\"password\":\"$NAUKRI_PASSWORD\"}" \
    --max-time 600 2>&1)

log "Response: $RESPONSE"

# ── Report result ──────────────────────────────────────────────────────────────
if echo "$RESPONSE" | grep -q '"success":true'; then
    PDF=$(echo "$RESPONSE" | grep -o '"pdfPath":"[^"]*"' | cut -d'"' -f4)
    log "SUCCESS — PDF: $PDF"
else
    log "FAILED — check response above"
    log "════════════════════════════════════════════════════════"
    exit 1
fi

log "Resume Upload Job COMPLETE"
log "════════════════════════════════════════════════════════"
