# Phone Ordering Recording Path

e-Setu places no calls itself. The supplier calls the shopkeeper with their own
phone's dialler (or records the conversation in the browser), uploads the
recording, and the existing STT → extraction → review → order pipeline does the
rest. Telephony platforms (Plivo/Infobip), outbound call origination, webhooks,
call mirroring and wait notices are gone; nothing in this document depends on
them.

## The supplier's flow (screen: कॉल ऑर्डर, `/supplier-phone`)

1. **कॉल करें** – the supplier dials the shopkeeper on their own phone, exactly
   as they always have. e-Setu is not on the line.
2. **रिकॉर्ड करें** – two equal choices on the upload tab:
   * record right there in the browser (MediaRecorder; prefers `audio/webm`,
     falls back to `audio/mp4` on iOS), with a 10-minute timer that stops
     recording by itself; or
   * use a recording made earlier with the phone's recorder app and pick the
     file instead (WAV, MP3, M4A, AAC or WEBM).
   A preview player lets the supplier listen before uploading, and the file
   size is checked against the server's limit before any bytes leave the phone.
3. **अपलोड करें** – the shopkeeper must be picked first (searchable customer
   list; the order bridge refuses an unidentified customer, so the upload
   requires it). The upload shows real percentage progress and answers with
   `202` as soon as the bytes are safely stored — transcription does not hold
   the connection open.
4. **इंतज़ार करें** – a status card advances on its own every 15 seconds through
   the Hindi stage labels ("रिकॉर्डिंग तैयार हो रही है" → "आवाज़ लिखी जा रही है"
   → "सामान जुदा किए जा रहे हैं" → "जाँच के लिए तैयार"). Polling pauses while
   the tab is hidden and stops once the run lands. A failed run offers
   "फिर कोशिश करें" (retry) instead of an error code.
5. **जाँच करें, ऑर्डर बनाएँ** – the review lists every extracted line with its
   flag in Hindi ("मैच नहीं", "कितने?", "सुधारें"…). The supplier fixes what is
   flagged (or adds a missing item), then taps "ऑर्डर पक्का करें" once: the
   same tap confirms the draft and asks the bridge for the real order. The
   order appears inline with "ऑर्डर देखें" into today's orders.

The screen has exactly two tabs: **रिकॉर्डिंग अपलोड करें** (default — record /
upload, plus the running status card, the review, and a "जाँच बाकी" list of
calls still needing attention) and **बने हुए ऑर्डर** (orders this supplier's
recordings produced, with their live status). The accuracy report
(`/pilot/accuracy`) deep-links into a specific call via
`/supplier-phone?callId=…`, which opens that call straight in the review or
status card.

## API

All three routes are supplier-only (`isAuthenticated` + `isSupp`): a missing or
invalid token is `400`, a shopkeeper session is `403`.

| Route | Purpose |
| --- | --- |
| `GET /api/v1/phone-orders/config` | `{ maxAudioBytes, maxDurationSeconds: 600, formats: ["mp3","m4a","wav","aac","webm"] }` — the screen never hardcodes a limit. |
| `POST /api/v1/phone-orders/recording` | Multipart upload: field `audio`, field `customerUserId` (required). |
| `GET /api/v1/phone-orders/orders?limit=` | Orders written by the bridge for this supplier, newest first, read straight off the `Order` documents. |

Upload outcomes:

* `202` happy path — `{ callId, pilotCallId, stage: "transcribing",
  durationSeconds, audio: { bytes, contentType, maxBytes }, message }`; the
  pipeline is started in the background before the response is sent.
* `200` duplicate — the same bytes (sha256) under the same supplier were
  already uploaded; the existing call, stage and `orderCreated` flag are
  returned instead of an error (a double tap or a re-selected file is friendly,
  never a failure).
* `400` — `AUDIO_REQUIRED`, `CUSTOMER_REQUIRED` ("किस दुकानदार की रिकॉर्डिंग
  है? पहले वह चुनें।"), `CUSTOMER_NOT_FOUND`, `AUDIO_DURATION_UNKNOWN`.
* `413` — `AUDIO_TOO_LARGE` (multer's byte cap, simple Hindi message) or
  `AUDIO_TOO_LONG` (over 600 seconds).
* `415` — unsupported type or unreadable audio: "यह फ़ाइल नहीं चलेगी। कृपया
  MP3, M4A, WAV, AAC या WEBM रिकॉर्डिंग चुनें।"
* `409` — `DUPLICATE_AUDIO` (unique index race lost after the friendly read).
* `503` — `AUDIO_CLOUD_UPLOAD_FAILED` (durable storage refused the bytes;
  nothing was processed).

Every refusal carries a simple Hindi `message`; the screens show that message
and never an HTTP status or a stack trace.

## What happens after the upload

The bytes are stored first, then `PhoneCall` (parties, supplier, duration) and
`PhoneCallPilot` (caller = the picked shopkeeper, `customer.method:
"supplier-selected"`, `pipeline.stage: "transcribing"`, `recordingReadyAt`
stamp) are written, and `startPipelineInBackground` runs the existing
pipeline: FFmpeg normalisation → Sarvam STT → LLM extraction → catalog
matching → supplier draft. Stages are `new`, `processing_recording`,
`transcribing`, `extracting`, `completed`, `failed`.

## Limits and validation

* **Duration ≤ 600 seconds** (10 minutes), probed before anything is stored;
  a WAV header probe covers environments without ffmpeg.
* **Size ≤ `PILOT_MAX_AUDIO_BYTES`** (64 MB by default), enforced twice: the
  screen checks `/config` before uploading, multer enforces it server-side.
* **Formats**: WAV, MP3, M4A, AAC, WEBM — checked by extension *and* MIME
  (a `;codecs=…` suffix is stripped first, so MediaRecorder's
  `audio/webm;codecs=opus` is accepted).
* **Duplicate guard**: sha256 digest, unique per supplier — one recording is
  never processed twice.

## Storage and retention

Audio is stored privately, streamed only through authenticated endpoints, and
removed after `PILOT_AUDIO_RETENTION_DAYS` (30 days by default). Storage has
two backends behind one interface, chosen by `PILOT_AUDIO_BACKEND` (`auto` by
default): in production, with `CLOUD_NAME`/`API_KEY`/`API_SECRET` set,
recordings go to durable Cloudinary storage; otherwise they go to the local
directory. Falling back to local disk in production is ephemeral and is
reported as a warning at startup, because a redeploy would otherwise silently
lose the only copy.

Durable recordings are uploaded as `esetu/phone-calls` assets with
`type: authenticated`, so they have no public delivery URL and cannot be
listed or searched; the asset name is built from nothing the supplier
supplies; and the original format is preserved rather than re-encoded. The
backend is the only reader, using a signed URL requested after ownership of
the call is verified. Transcription still works on a file path, so a durable
recording is fetched into a short-lived working copy under
`PILOT_AUDIO_DIR/tmp` for the length of the run and removed afterwards.
Nothing on the failure path deletes the stored recording, which is what makes
a retry after a redeploy work. Recordings taken before durable storage existed
keep working as local files; `npm run backfill:audio` (dry run) and
`npm run backfill:audio -- --apply` move them across idempotently.

After retention cleanup, file and digest references are cleared so an upload
can be retried only when no transcript/review pilot already exists for that
call. The same period ages durable recordings by `storedAt` (local files by
mtime); an asset is deleted only once no real Order depends on the call, no
pipeline stage is reading it, and no order is being created against it. A
recording an order was built from is kept, because the supplier may need to
listen back. The reference is cleared only after the delete succeeds.

## One-tap confirm and the order bridge

Ordering is one tap, not two, but never zero. The supplier still reads every
line of the extracted draft and resolves anything flagged before confirming;
the confirm tap sends `createOrder: true`, and the bridge does all the
writing. Nothing the AI produced is trusted at that point: the bridge
re-resolves each product, variant, availability and price against the live
catalog, refuses an unidentified customer, and merges into the customer's
existing pending order under the same per-user lock the cart uses. If the
bridge refuses, the confirmed draft is kept and the exact Hindi reason is
shown, and confirming again retries the order rather than short-circuiting. A
draft confirmed earlier and left unordered stays visible with a retry; a draft
already carrying an order says so instead of offering a second one.

## Pipeline robustness

Each run is stamped with `pipeline.recordingReadyAt` at creation; every write
a run makes filters on that token, so a run that gets superseded (retry button
or recovery sweep) aborts instead of corrupting another run's document. The
repair sweep (`startPilotPipelineRecovery`) reclaims runs stuck in an
in-flight stage past `PILOT_CLAIM_TIMEOUT_MS` and restarts their pipeline
every `PILOT_RECOVERY_INTERVAL_MS` (5 min). `PhoneCallPilot.phoneCallId` has
a partial unique index so no two pilots can exist for one call.

## Removed with telephony

Routes `/calling`, `/order-call`, `/pilot/phone-orders` and `/pilot/test-audio`
and their pages (`OrderCall`, `Calling`, `PhoneOrderPilot`, `TestAudioPage`)
are deleted, along with `phoneCallingApi.js`. Environment variables removed
from `.env` and `.env.example`: `PILVO_*`, `INFOBIP_*`,
`PILOT_TELEPHONY_PROVIDER`, `PILOT_OUTBOUND_RATE_PER_MIN`,
`PILOT_TEST_AUDIO_ENABLED`, `APP_BASE_URL`.

## Tests

`npm test` in `backend/` — 178 pass, 0 fail. Upload coverage lives in
`test/phoneOrderUpload.test.js` (formats incl. WebM, validation, size/digest,
auth 400, shopkeeper 403, happy 202, duplicate 200, oversize 413, DB-failure
409, config/orders) and `test/phoneOrderDuration.test.js` (600 s accepted,
601 s refused with `AUDIO_TOO_LONG`, WAV probe without ffmpeg).
