from argparse import ArgumentParser
from pathlib import Path
from PIL import Image


def crop_pose(sheet, box, out):
    # Extract the supplied pixels and keep every frame on a common floor line.
    cell = sheet.crop(box)
    solid = cell.getchannel("A").point(lambda alpha: 255 if alpha >= 32 else 0)
    left, top, right, bottom = solid.getbbox()
    frame = cell.crop((max(0, left - 3), max(0, top - 3),
                       min(cell.width, right + 3), min(cell.height, bottom + 3)))
    canvas = Image.new("RGBA", (420, 510))
    canvas.paste(frame, ((canvas.width - frame.width) // 2, 504 - frame.height))
    canvas.save(out)


def main():
    parser = ArgumentParser(description="Extract private wagespack character frames")
    for name in ("walk", "standing", "boy-work", "girl-work"):
        parser.add_argument(f"--{name}", required=True, type=Path)
    args = parser.parse_args()
    sheets = {key: Image.open(value).convert("RGBA") for key, value in vars(args).items()}
    if any(sheet.size != (1536, 1024) for sheet in sheets.values()):
        parser.error("Expected 1536×1024 reference sheets")
    folder = Path(__file__).resolve().parents[1] / "private-assets"
    folder.mkdir(exist_ok=True)
    poses = {
        "boy-idle": ("standing", (60, 520, 350, 1004)),
        "girl-idle": ("standing", (40, 30, 352, 515)),
        "boy-open-0": ("boy_work", (405, 10, 737, 512)),
        "boy-open-1": ("boy_work", (774, 10, 1097, 512)),
        "girl-open-0": ("walk", (426, 35, 722, 503)),
        "girl-open-1": ("walk", (805, 35, 1100, 503)),
        "boy-working-0": ("boy_work", (56, 528, 352, 1004)),
        "boy-working-1": ("boy_work", (434, 525, 733, 1004)),
        "girl-working-0": ("girl_work", (20, 34, 364, 505)),
        "girl-working-1": ("girl_work", (412, 35, 765, 505)),
        "boy-break-0": ("standing", (802, 548, 1079, 1000)),
        "boy-break-1": ("standing", (1184, 548, 1457, 1000)),
        "girl-break-0": ("standing", (796, 67, 1106, 516)),
        "girl-break-1": ("standing", (1185, 62, 1495, 516)),
        "boy-phone": ("boy_work", (65, 13, 324, 514)),
        "boy-point": ("boy_work", (1136, 22, 1508, 512)),
        "boy-walk": ("walk", (62, 519, 352, 1005)),
        "girl-walk": ("walk", (54, 38, 342, 503)),
        "girl-look": ("standing", (453, 30, 738, 515)),
        "girl-think": ("girl_work", (45, 544, 366, 989)),
    }
    for name, (sheet, box) in poses.items():
        crop_pose(sheets[sheet], box, folder / (name + ".png"))


if __name__ == "__main__":
    main()
