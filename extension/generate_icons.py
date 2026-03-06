#!/usr/bin/env python3
"""Generate PNG icons for the Memory AI Chrome extension."""

import struct
import zlib
import os

def create_png(size):
    """Generate a PNG icon with purple gradient and lightbulb."""
    pixels = []
    for y in range(size):
        row = []
        for x in range(size):
            nx, ny = x / size, y / size

            # Rounded rect
            cr = 0.22
            inside = True
            corners = [
                (cr, cr),
                (1 - cr, cr),
                (cr, 1 - cr),
                (1 - cr, 1 - cr),
            ]
            for ccx, ccy in corners:
                if (nx < cr and ccx == cr or nx > 1 - cr and ccx == 1 - cr) and \
                   (ny < cr and ccy == cr or ny > 1 - cr and ccy == 1 - cr):
                    ddx = nx - ccx
                    ddy = ny - ccy
                    if ddx * ddx + ddy * ddy > cr * cr:
                        inside = False
                    break

            if not inside:
                row.extend([0, 0, 0, 0])
                continue

            # Purple gradient background
            t = (nx + ny) / 2
            r = int(139 * (1 - t) + 109 * t)
            g = int(92 * (1 - t) + 40 * t)
            b = int(246 * (1 - t) + 217 * t)

            # White lightbulb
            cx, cy = 0.5, 0.44
            ddx = nx - cx
            ddy = ny - cy
            dist = (ddx * ddx + ddy * ddy) ** 0.5

            in_bulb = dist < 0.22 and ny < 0.56
            in_neck = abs(nx - 0.5) < 0.09 and 0.50 < ny < 0.68
            in_base = abs(nx - 0.5) < 0.07 and (abs(ny - 0.70) < 0.015 or abs(ny - 0.74) < 0.015)

            if in_bulb or in_neck or in_base:
                r, g, b = 255, 255, 255

            row.extend([r, g, b, 255])
        pixels.append(bytes(row))

    def make_chunk(ctype, data):
        c = ctype + data
        crc = zlib.crc32(c) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + c + struct.pack(">I", crc)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = make_chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))

    raw = b""
    for row in pixels:
        raw += b"\x00" + row
    idat = make_chunk(b"IDAT", zlib.compress(raw))
    iend = make_chunk(b"IEND", b"")

    return sig + ihdr + idat + iend


if __name__ == "__main__":
    os.makedirs("icons", exist_ok=True)
    for s in [16, 32, 48, 128]:
        path = f"icons/icon{s}.png"
        with open(path, "wb") as f:
            f.write(create_png(s))
        print(f"Created {path} ({os.path.getsize(path)} bytes)")
