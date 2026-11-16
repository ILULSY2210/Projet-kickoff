# usage: python3 sheet.py <dossier_captures>   -> écrit sheet-phone.png et sheet-other.png
import sys, os, glob
from PIL import Image, ImageDraw
d = sys.argv[1]
def grid(files, cell_w, cols, name):
    ims = []
    for f in files:
        if not os.path.exists(f): continue
        im = Image.open(f).convert('RGB'); h = round(im.height * cell_w / im.width)
        ims.append((os.path.basename(f)[:-4], im.resize((cell_w, h), Image.LANCZOS)))
    if not ims: return
    ch = max(i.height for _, i in ims) + 22; rows = -(-len(ims) // cols)
    out = Image.new('RGB', (cols * (cell_w + 8) + 8, rows * (ch + 8) + 8), (40, 40, 40)); dr = ImageDraw.Draw(out)
    for k, (n, im) in enumerate(ims):
        x = 8 + (k % cols) * (cell_w + 8); y = 8 + (k // cols) * (ch + 8)
        dr.text((x + 2, y + 4), n, fill=(255, 255, 255)); out.paste(im, (x, y + 22))
    out.save(os.path.join(d, name))
P = lambda *n: [os.path.join(d, x + '.png') for x in n]
grid(P('01-menu','02-play01','03-play07','04-boss10','05-fx','06-win'), 390, 3, 'sheet-phone-a.png')
grid(P('07-fail','08-play23','09-menu-progress','10-levels','11-pause'), 390, 3, 'sheet-phone-b.png')
grid(P('12-small-menu','13-small-play09','14-small-win'), 360, 3, 'sheet-small.png')
grid(P('15-desk-menu','16-desk-play06'), 900, 2, 'sheet-desk.png')
print('sheets ok')
