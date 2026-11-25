#!/bin/sh
# One command: picture (1080×1920, 30 fps), score + foley + voice, master → emberbound.mp4 (+ subtitles, poster)
set -e
LIB=${LIB:-/root/lemo-opuscar}
HERE=$(cd "$(dirname "$0")" && pwd)
export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the library folder"; exit 1; }
cd "$LIB"
"$LIB/.venv/bin/python" core/audio/sampler.py --need "$HERE/mix.py"
[ -f "$HERE/voices/v01.wav" ] || "$LIB/.venv/bin/python" core/tts/tts.py "$HERE/tts/lines.json" "$HERE/voices"
node core/render/events.mjs "$HERE" --size 1080x1920
"$LIB/.venv/bin/python" "$HERE/mix.py"
node core/render/video.mjs "$HERE" --size 1080x1920 --fps 30 --workers 4 --out "$HERE/out/video.mp4"
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/emberbound.mp4" 30 1
"$LIB/.venv/bin/python" - "$HERE" <<'PY'
import json, sys; h = sys.argv[1]
tl = json.load(open(f'{h}/timeline.json')); d = json.load(open(f'{h}/voices/dur.json'))
json.dump([{'t0': v['t'] - .15, 't1': v['t'] + max(1.8, d[v['id']] + .6), 'text': v['text']} for v in tl['vo']], open(f'{h}/out/cues.json', 'w'))
PY
"$LIB/.venv/bin/python" core/render/srt.py "$HERE/out/cues.json" "$HERE/subtitles_en.srt"
node core/render/still.mjs "$HERE" 28.2 --size 1080x1920 --out "$HERE/out/poster" && cp "$HERE/out/poster/t_28.2.jpg" "$HERE/poster.jpg"
echo "done: $HERE/emberbound.mp4"
