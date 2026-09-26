from pathlib import Path
p=Path('/home/ubuntu/onchain-queue-dashboard/client/src/pages/Home.tsx')
s=p.read_text()
s=s.replace('onClick={loadOnchain}', 'onClick={() => void loadOnchain()}')
p.write_text(s)
