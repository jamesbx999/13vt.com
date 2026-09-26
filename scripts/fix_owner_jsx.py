from pathlib import Path

path = Path('/home/ubuntu/onchain-queue-dashboard/client/src/pages/OwnerDashboard.tsx')
text = path.read_text()
old = '{&&search </div>{search &&</div>{search &&'
new = '</div>{search &&'
if old not in text:
    raise SystemExit('Owner JSX corruption marker not found')
path.write_text(text.replace(old, new, 1))
