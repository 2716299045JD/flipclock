import re
import sys

html = open(sys.argv[1], encoding='utf-8', errors='ignore').read()
spans = re.findall(r'<span>(\d)</span>', html)
groups = [spans[i:i + 4] for i in range(0, len(spans), 4)]
bad = [g for g in groups if len(g) == 4 and len(set(g)) != 1]

print('total digits:', len(spans))
print('cards:', len(groups))
print('inconsistent:', len(bad))
for g in bad[:12]:
    print('  MISMATCH', ''.join(g), '  top/mid/flapTop/flapBottom')
print('STATUS', 'PASS' if not bad else 'FAIL')
