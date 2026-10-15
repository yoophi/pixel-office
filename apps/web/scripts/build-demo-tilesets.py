"""Pixel Agents 원본을 16px Tiled 호환 아틀라스로 조립한다.
실행: uv run --with pillow python scripts/build-demo-tilesets.py
"""
from pathlib import Path
from PIL import Image, ImageChops

assets = Path(__file__).resolve().parents[1] / 'public/assets'
output = assets / 'generated'
output.mkdir(exist_ok=True)
floor = Image.open(assets / 'floors/floor_6.png').convert('RGBA')
wall = Image.open(assets / 'walls/wall_0.png').convert('RGBA').crop((32, 80, 48, 96))
table = Image.open(assets / 'furniture/COFFEE_TABLE/COFFEE_TABLE.png').convert('RGBA')
books = Image.open(assets / 'furniture/DOUBLE_BOOKSHELF/DOUBLE_BOOKSHELF.png').convert('RGBA')

for name, floor_color, wall_color in [
    ('warm', '#c9b38d', '#bbc9b9'),
    ('dark', '#849b98', '#718780'),
]:
    atlas = Image.new('RGBA', (160, 16))
    atlas.paste(ImageChops.multiply(floor, Image.new('RGBA', floor.size, floor_color)), (0, 0))
    atlas.paste(ImageChops.multiply(wall, Image.new('RGBA', wall.size, wall_color)), (16, 0))
    for start, furniture in [(2, table), (6, books)]:
        for row in range(2):
            for col in range(2):
                tile = furniture.crop((col * 16, row * 16, (col + 1) * 16, (row + 1) * 16))
                atlas.paste(tile, ((start + row * 2 + col) * 16, 0))
    atlas.save(output / f'pixel-office-{name}.png')
