"""Generate monochrome extension icons with the Python standard library."""
from pathlib import Path
import struct, zlib

def rounded(x, y, left, top, right, bottom, radius):
    dx=max(left+radius-x,0,x-(right-radius))
    dy=max(top+radius-y,0,y-(bottom-radius))
    return left<=x<=right and top<=y<=bottom and dx*dx+dy*dy<=radius*radius

def pixel(x,y):
    if not rounded(x,y,0,0,128,128,22): return (255,255,255,0)
    for left in (32,70):
        if rounded(x,y,left,39,left+26,67,3): return (255,255,255,255)
        if left+14<=x<=left+26 and 65<=y<=76 and x+y<=left+99: return (255,255,255,255)
    return (24,24,24,255)

def chunk(kind,data):
    return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)

for size in (16,32,48,128):
    data=bytearray()
    for row in range(size):
        data.append(0)
        for col in range(size):
            samples=[pixel((col+(i+.5)/4)*128/size,(row+(j+.5)/4)*128/size) for j in range(4) for i in range(4)]
            alpha=sum(p[3] for p in samples)
            rgb=[round(sum(p[c]*p[3] for p in samples)/alpha) if alpha else 255 for c in range(3)]
            data.extend((*rgb,round(alpha/16)))
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(data))+chunk(b'IEND',b'')
    Path(f'extension/icons/{size}.png').write_bytes(png)
