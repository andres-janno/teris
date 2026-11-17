#!/usr/bin/env python3
# Ehitatud CSS-i klasside võrdlus ja kokkupõrked vana CSS-iga.
# Kasutus: python3 scripts/css-utils.py list <dist>            — klasside arv ja faili suurus
#          python3 scripts/css-utils.py diff <dist_a> <dist_b> — uued klassid B-s ja need, mis kattuvad index.css/map.css/admin.css klassidega
import glob, os, re, sys

def app_css(dist):
    files = [f for f in glob.glob(os.path.join(dist, 'assets', '*.css')) if not re.search(r'(admin|landing)-', f)]
    return max(files, key=os.path.getsize)

def classes(text):
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    out = set()
    for m in re.finditer(r'\.((?:\\.|[A-Za-z_-])(?:\\.|[A-Za-z0-9_-])*)', text):
        out.add(re.sub(r'\\(.)', r'\1', m.group(1)))
    return out

def legacy():
    out = set()
    for p in ('src/index.css', 'src/styles/map.css', 'src/admin/admin.css'):
        out |= classes(open(p).read())
    return out

cmd = sys.argv[1]
if cmd == 'list':
    f = app_css(sys.argv[2])
    print(os.path.basename(f), os.path.getsize(f), 'baiti,', len(classes(open(f).read())), 'klassi')
elif cmd == 'diff':
    a, b = (classes(open(app_css(d)).read()) for d in sys.argv[2:4])
    new = sorted(b - a)
    clash = sorted(set(new) & legacy())
    print(f'uusi klasse: {len(new)}')
    print('  ' + '  '.join(new))
    print(f'neist kattub vana CSS-iga (KONTROLLI KÄSITSI): {len(clash)}')
    print('  ' + '  '.join(clash))
