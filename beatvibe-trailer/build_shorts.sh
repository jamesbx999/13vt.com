#!/bin/sh
# Vertical 1080×1920 version for YouTube Shorts → beatvibe-trailer-shorts.mp4
# Music: MUSIC=<audio file> uses that track (cut to the film's length) instead of the original score.
set -e
LIB=${LIB:-/root/lemo-opuscar}
HERE=$(cd "$(dirname "$0")" && pwd)
export LIB
cd "$LIB"
[ -f "$HERE/paper_v.jpg" ] || (cd "$HERE" && "$LIB/.venv/bin/python" paper_v.py)
[ -f "$HERE/out/video_v.mp4" ] || node core/render/video.mjs "$HERE" --size 1080x1920 --q 'fmt=v' --fps 60 --workers 4 --out "$HERE/out/video_v.mp4"
if [ -n "$MUSIC" ]; then MUSIC="$MUSIC" "$LIB/.venv/bin/python" "$HERE/mix.py" "$HERE/out/mix_v.wav"
else [ -f "$HERE/out/mix.wav" ] || "$LIB/.venv/bin/python" "$HERE/mix.py"; cp "$HERE/out/mix.wav" "$HERE/out/mix_v.wav"; fi
sh core/render/mux.sh "$HERE/out/video_v.mp4" "$HERE/out/mix_v.wav" "$HERE/beatvibe-trailer-shorts.mp4" 60 1
node core/render/still.mjs "$HERE" 14.6 --size 1080x1920 --q 'fmt=v' --out "$HERE/out/poster_v" && cp "$HERE/out/poster_v/t_14.6.jpg" "$HERE/poster_shorts.jpg"
echo "done: $HERE/beatvibe-trailer-shorts.mp4"
