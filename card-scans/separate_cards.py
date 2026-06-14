"""
separate_cards.py
-----------------
Crops individual cards from a Castle Ravenloft card-sheet image.

Usage:
    python separate_cards.py <input_image> [--output-dir <dir>]

Expects a grid image with cards arranged in rows by hero class.
Auto-detects grid dimensions or accepts manual overrides.
"""

import sys
import os
import argparse
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow not found. Installing...")
    os.system(f"{sys.executable} -m pip install Pillow")
    from PIL import Image


# ---------------------------------------------------------------------------
# Card metadata — names in left-to-right order per row.
# Update these if your sheet has a different layout.
# ---------------------------------------------------------------------------

CARD_ROWS = [
    {
        "class": "wizard",
        "cards": [
            "magic_missile",
            "thunderwave",
            "scorching_burst",
            "freezing_cloud",
            "lightning_bolt",
            "fireball",
            "fey_step",
            "shield",
            "dispel_magic",
            "illusionary_crowd",
            "wizard_card_11",   # update name if you know it
        ],
    },
    {
        "class": "fighter",
        "cards": [
            "cleave",
            "trapping_strike",
            "tide_of_iron",
            "dragons_breath",
            "come_and_get_it",
            "precise_strike",
            "brute_strike",
            "unstoppable",
            "bodyguard",
            "get_over_there",
            "fighter_card_11",  # update name if you know it
        ],
    },
    {
        "class": "rogue",
        "cards": [
            "snipe_shot",
            "backstab",
            "deft_strike",
            "dagger_barrage",
            "riposte_strike",
            "deep_cut",
            "sneak_attack",
            "great_leap",
            "spring_away",
            "stealth",
            "rogue_card_11",    # update name if you know it
        ],
    },
    {
        "class": "ranger",
        "cards": [
            "hunters_shot",
            "careful_attack",
            "hit_and_run",
            "twin_shot",
            "attacks_on_the_run",
            "bounding_attack",
            "split_the_tree",
            "yield_ground",
            "crucial_aid",
            "unbalancing_parry",
            "ranger_card_11",   # update name if you know it
        ],
    },
    {
        "class": "cleric",
        "cards": [
            "healing_strike",
            "divine_flare",
            "lance_of_faith",
            "flame_strike",
            "hallowed_advance",
            "beacon_of_hope",
            "healing_word",
            "bless",
            "shield_of_faith",
            "consecrated_ground",
            "cleric_card_11",   # update name if you know it
        ],
    },
]


def detect_grid(img: Image.Image, num_rows: int, num_cols: int):
    """
    Divides the image evenly into a grid and returns a list of
    (row, col, box) tuples where box = (left, top, right, bottom).

    Optionally you can pass --margin to trim a pixel border from each cell.
    """
    w, h = img.size
    cell_w = w / num_cols
    cell_h = h / num_rows

    cells = []
    for row in range(num_rows):
        for col in range(num_cols):
            left   = int(col * cell_w)
            top    = int(row * cell_h)
            right  = int((col + 1) * cell_w)
            bottom = int((row + 1) * cell_h)
            cells.append((row, col, (left, top, right, bottom)))
    return cells, cell_w, cell_h


def crop_cards(
    input_path: str,
    output_dir: str,
    num_rows: int,
    num_cols: int,
    margin: int = 3,
):
    img = Image.open(input_path)
    w, h = img.size

    # Trim the black bar at the bottom — cards occupy roughly the top 72% of the sheet
    card_area_h = int(h * 0.725)
    img = img.crop((0, 0, w, card_area_h))
    h = card_area_h

    print(f"Image size: {w}x{h}px (trimmed) -> grid {num_rows}x{num_cols}  "
          f"(~{w/num_cols:.0f}x{h/num_rows:.0f}px per card)")

    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    cells, cell_w, cell_h = detect_grid(img, num_rows, num_cols)
    count = 0

    for row_idx, row_data in enumerate(CARD_ROWS):
        hero_class = row_data["class"]
        card_names = row_data["cards"]

        for col_idx, card_name in enumerate(card_names):
            if col_idx >= num_cols:
                print(f"  SKIP col {col_idx} (out of bounds)")
                continue

            # Find the matching cell
            matching = [(r, c, box) for r, c, box in cells
                        if r == row_idx and c == col_idx]
            if not matching:
                continue

            _, _, (left, top, right, bottom) = matching[0]

            # Apply margin to remove card borders/gaps
            crop_box = (
                left   + margin,
                top    + margin,
                right  - margin,
                bottom - margin,
            )

            card_img = img.crop(crop_box)

            filename = f"{hero_class}_{card_name}.jpg"
            save_path = out_path / filename
            card_img.save(save_path, quality=95)
            print(f"  OK  {filename}  ({card_img.width}x{card_img.height}px)")
            count += 1

    print(f"\nDone — {count} cards saved to '{output_dir}/'")


def main():
    parser = argparse.ArgumentParser(description="Crop Castle Ravenloft cards from a sheet image.")
    parser.add_argument("input", help="Path to the card-sheet image (JPEG, PNG, etc.)")
    parser.add_argument("--output-dir", default="separated", help="Output directory (default: ./separated)")
    parser.add_argument("--rows", type=int, default=len(CARD_ROWS), help="Number of card rows in the sheet")
    parser.add_argument("--cols", type=int, default=11, help="Number of card columns in the sheet")
    parser.add_argument("--margin", type=int, default=3, help="Pixels to trim from each card edge (default: 3)")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"ERROR: File not found: {args.input}")
        sys.exit(1)

    crop_cards(
        input_path=args.input,
        output_dir=args.output_dir,
        num_rows=args.rows,
        num_cols=args.cols,
        margin=args.margin,
    )


if __name__ == "__main__":
    main()
