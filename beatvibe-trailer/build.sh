#!/bin/sh
# One command: picture, score + foley + voice, master → beatvibe-trailer.mp4 (+ subtitles, poster)
set -e
LIB=${LIB:-/root/lemo-opuscar}
HERE=$(cd "$(dirname "$0")" && pwd)
export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the library folder"; exit 1; }
cd "$LIB"
"$LIB/.venv/bin/python" core/audio/sampler.py --need "$HERE/mix.py"
[ -f "$HERE/voices/v01.wav" ] || "$LIB/.venv/bin/python" core/tts/tts.py "$HERE/tts/lines.json" "$HERE/voices"
[ -f "$HERE/fonts.css" ] || (cd "$HERE" && node fetch_fonts.mjs)
[ -f "$HERE/paper.jpg" ] || (cd "$HERE" && "$LIB/.venv/bin/python" paper.py)
node core/render/events.mjs "$HERE"
"$LIB/.venv/bin/python" "$HERE/mix.py"
node core/render/video.mjs "$HERE" --fps 60 --workers 4 --out "$HERE/out/video.mp4"
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/beatvibe-trailer.mp4" 60 1
"$LIB/.venv/bin/python" - "$HERE" <<'PY'
import json, sys; h = sys.argv[1]
tl = json.load(open(f'{h}/timeline.json')); d = json.load(open(f'{h}/voices/dur.json'))
json.dump([{'t0': v['t'] - .1, 't1': v['t'] + max(1.8, d[v['id']] + .6), 'text': v['text']} for v in tl['vo']], open(f'{h}/out/cues.json', 'w'))
PY
"$LIB/.venv/bin/python" core/render/srt.py "$HERE/out/cues.json" "$HERE/subtitles_en.srt"
node core/render/still.mjs "$HERE" 14.6 --out "$HERE/out/poster" && cp "$HERE/out/poster/t_14.6.jpg" "$HERE/poster.jpg"
echo "done: $HERE/beatvibe-trailer.mp4"
