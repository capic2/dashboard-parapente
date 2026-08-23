#!/usr/bin/env python3
"""Prepare 360-degree highlight candidates and render approved clips.

The script deliberately separates candidate preparation from final rendering:
the agent or user can inspect the generated candidates and approve timestamps
and yaw values in a JSON file before an expensive render.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path


def run(*args: str, capture: bool = False) -> str:
    result = subprocess.run(args, check=True, text=True, capture_output=capture)
    return result.stdout.strip() if capture else ""


def duration(path: Path) -> float:
    output = run(
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path), capture=True,
    )
    return float(output)


def render_projection(source: Path, target: Path, start: float, yaw: int, length: float) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    vf = (
        f"v360=input=e:output=rectilinear:yaw={yaw}:pitch=0:h_fov=100:w=960:h=480,"
        "scale=960:480:force_original_aspect_ratio=decrease,"
        "pad=960:480:(ow-iw)/2:(oh-ih)/2"
    )
    run(
        "ffmpeg", "-y", "-ss", f"{start:.3f}", "-i", str(source), "-t", f"{length:.3f}",
        "-vf", vf,
        "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", str(target),
    )


def render_clip(source: Path, target: Path, start: float, yaw: int, length: float) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    vf = (
        f"v360=input=e:output=rectilinear:yaw={yaw}:pitch=0:h_fov=100:w=1920:h=960,setsar=1"
    )
    run(
        "ffmpeg", "-y", "-ss", f"{start:.3f}", "-i", str(source), "-t", f"{length:.3f}",
        "-vf", vf, "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(target),
    )


def prepare(source: Path, out: Path, window: float, step: float) -> None:
    total = duration(source)
    angles = tuple(range(-180, 180, 45))
    candidates = []
    index = 0
    start = 0.0
    while start < max(total - window, 0):
        for yaw in angles:
            target = out / "candidates" / f"candidate-{index:04d}-yaw-{yaw}.mp4"
            render_projection(source, target, start, yaw, window)
            candidates.append({"id": target.stem, "start": round(start, 3), "length": window, "yaw": yaw, "preview": str(target)})
            index += 1
        start += step
    (out / "candidates.json").write_text(json.dumps({"source": str(source), "duration": total, "candidates": candidates}, indent=2), encoding="utf-8")


def render(source: Path, out: Path, selection: Path) -> None:
    data = json.loads(selection.read_text(encoding="utf-8"))
    clips = []
    for index, item in enumerate(data["clips"], start=1):
        target = out / f"clip-{index:02d}.mp4"
        render_clip(source, target, float(item["start"]), int(item["yaw"]), float(item.get("length", 5)))
        clips.append({**item, "output": str(target)})
    concat = out / "concat.txt"
    concat.write_text("\n".join(f"file '{clip['output']}'" for clip in clips) + "\n", encoding="utf-8")
    final = out / "highlights-original-format.mp4"
    run("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", "-movflags", "+faststart", str(final))
    (out / "report.json").write_text(json.dumps({"source": str(source), "output": str(final), "clips": clips}, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("prepare", help="generate low-resolution angle candidates")
    p.add_argument("source", type=Path)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--window", type=float, default=5)
    p.add_argument("--step", type=float, default=10)
    r = sub.add_parser("render", help="render clips from an approved selection JSON")
    r.add_argument("source", type=Path)
    r.add_argument("selection", type=Path, help='JSON: {"clips":[{"start":12,"length":6,"yaw":90}]}')
    r.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        parser.error("ffmpeg et ffprobe sont requis")
    if args.command == "prepare":
        prepare(args.source, args.out, args.window, args.step)
    else:
        render(args.source, args.out, args.selection)


if __name__ == "__main__":
    main()
