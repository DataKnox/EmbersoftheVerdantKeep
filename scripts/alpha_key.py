#!/usr/bin/env python3
"""Strip the painted-on background from gpt-image-2 outputs.

The model returns sprite/tile assets with a checkerboard-pattern background
(two grey-white shades) and parallax mid/near layers with a pure-black upper
portion, even when the prompt asks for transparency.

For sprite/tile/UI sheets we flood-fill from the image edges through any pixel
that's "bright" (R, G, B all > 200). This catches both checker shades but
leaves bright highlights INSIDE the character (steel sword glints, etc.)
intact because they're disconnected from the edge.

For parallax mid/near backgrounds we threshold pure-near-black, which is what
the model paints for the "transparent upper portion" half of the layer.

Run from repo root: `python3 scripts/alpha_key.py`
"""
from collections import deque
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "assets"
WHITE_THRESHOLD = 200   # all RGB channels above this is considered background
BLACK_THRESHOLD = 18    # any pixel with R,G,B all <= this is treated as bg-black


def flood_fill_white_bg(img: Image.Image) -> Image.Image:
    """Flood-fill bright (>200 in every channel) pixels reachable from the edges,
    setting them transparent. Bright pixels inside the sprite (not connected to
    the edge) are preserved.
    """
    W, H = img.size
    pixels = list(img.getdata())
    visited = bytearray(W * H)
    queue = deque()

    def is_bg(idx):
        r, g, b, _ = pixels[idx]
        return r > WHITE_THRESHOLD and g > WHITE_THRESHOLD and b > WHITE_THRESHOLD

    # Seed with every edge pixel that's bg-bright.
    for x in range(W):
        for y in (0, H - 1):
            i = y * W + x
            if not visited[i] and is_bg(i):
                visited[i] = 1
                queue.append(i)
    for y in range(1, H - 1):
        for x in (0, W - 1):
            i = y * W + x
            if not visited[i] and is_bg(i):
                visited[i] = 1
                queue.append(i)

    while queue:
        i = queue.popleft()
        x = i % W
        y = i // W
        for ni in (
            (y * W + x - 1) if x > 0 else -1,
            (y * W + x + 1) if x < W - 1 else -1,
            ((y - 1) * W + x) if y > 0 else -1,
            ((y + 1) * W + x) if y < H - 1 else -1,
        ):
            if ni >= 0 and not visited[ni] and is_bg(ni):
                visited[ni] = 1
                queue.append(ni)

    out = [(r, g, b, 0) if visited[i] else (r, g, b, a)
           for i, (r, g, b, a) in enumerate(pixels)]
    img.putdata(out)
    return img


def threshold_black_bg(img: Image.Image) -> Image.Image:
    """Make pure-near-black pixels transparent (for parallax mid/near layers)."""
    pixels = list(img.getdata())
    out = [(r, g, b, 0) if (r <= BLACK_THRESHOLD and g <= BLACK_THRESHOLD and b <= BLACK_THRESHOLD)
           else (r, g, b, a) for r, g, b, a in pixels]
    img.putdata(out)
    return img


def process(path: Path, mode: str) -> None:
    img = Image.open(path).convert("RGBA")
    if mode == "white":
        img = flood_fill_white_bg(img)
    elif mode == "black":
        img = threshold_black_bg(img)
    out = path.parent / f"{path.stem}.alpha.png"
    img.save(out)
    n_trans = sum(1 for p in img.getdata() if p[3] == 0) / (img.width * img.height) * 100
    print(f"  {path.name} -> {out.name} ({mode}-key, {n_trans:.0f}% transparent)")


def main() -> None:
    print("Alpha-keying sprite/tile/UI sheets (flood-fill from edges)...")
    for d in [ROOT / "sprites", ROOT / "tiles", ROOT / "ui"]:
        for png in sorted(d.glob("*.png")):
            if ".alpha." in png.name:
                continue
            process(png, "white")

    print("Processing parallax backgrounds (mid/near keyed black, far kept opaque)...")
    for png in sorted((ROOT / "backgrounds").glob("*.png")):
        if ".alpha." in png.name:
            continue
        mode = "none" if "_far" in png.name else "black"
        if mode == "none":
            # Just copy through to .alpha.png so the manifest path stays valid.
            img = Image.open(png).convert("RGBA")
            img.save(png.parent / f"{png.stem}.alpha.png")
            print(f"  {png.name} -> {png.stem}.alpha.png (no keying)")
        else:
            process(png, mode)

    print("Done.")


if __name__ == "__main__":
    main()
