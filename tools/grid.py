# usage: python3 tools/grid.py dir name1 name2 ...  -> dir/grid.png
import sys
from PIL import Image
d, names = sys.argv[1], sys.argv[2:]
ims = [Image.open(f'{d}/{n}.png').resize((640, 380)) for n in names]
W = Image.new('RGB', (1280, 380 * ((len(ims) + 1) // 2)))
for i, im in enumerate(ims): W.paste(im, ((i % 2) * 640, (i // 2) * 380))
W.save(f'{d}/grid.png')
