#!/usr/bin/env python3
"""Assemble a captioned pitch video from a real browser recording.

Usage: python3 scripts/recording/render.py /absolute/path/manifest.json

Manifest:
{
  "rawVideo": "/absolute/path/recording.webm",
  "viewport": {"width": 1600, "height": 900},
  "scenes": [{"title": "Create an account", "caption": "Join as a seeker.",
              "start": 1.5, "end": 12.0}],
  "outputDir": "/absolute/path/deliverables"
}

The full browser frame stays visible above a separate caption band. Inputs
are retained. Only video is included; source audio, if any, is omitted.
Each scene may optionally specify its own absolute "rawVideo" path for a
different recorded take; start/end times always refer to that scene's source.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont


WIDTH, HEIGHT, FPS = 1920, 1080, 30
UI_WIDTH, UI_HEIGHT, UI_X = 1728, 972, 96
BACKGROUND = (16, 21, 34)
KOREAN_FONT = Path("/System/Library/Fonts/AppleSDGothicNeo.ttc")


@dataclass(frozen=True)
class Scene:
    title: str
    caption: str
    start: float
    end: float
    frames: int
    raw_video: Path | None = None

    @property
    def duration(self) -> float:
        return self.frames / FPS


def run(command: list[str]) -> str:
    result = subprocess.run(command, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(
            f"Command failed ({result.returncode}): {command[0]}\n"
            f"{' '.join(command[1:])}\n{result.stderr[-8000:]}"
        )
    return result.stdout


def find_binary(name: str) -> str:
    path = shutil.which(name)
    if not path:
        candidate = Path("/opt/homebrew/bin") / name
        if candidate.is_file():
            path = str(candidate)
    if not path:
        raise RuntimeError(f"Required executable is unavailable: {name}")
    return path


def probe(ffprobe: str, path: Path) -> dict:
    result = json.loads(run([
        ffprobe, "-v", "error", "-show_streams", "-show_format", "-show_chapters",
        "-of", "json", str(path),
    ]))
    streams = [stream for stream in result["streams"] if stream["codec_type"] == "video"]
    if not streams:
        raise ValueError(f"No video stream in {path}")
    stream = streams[0]
    duration_value = result.get("format", {}).get("duration") or stream.get("duration")
    return {
        "width": int(stream["width"]),
        "height": int(stream["height"]),
        "duration": float(duration_value) if duration_value is not None else None,
        "frameRate": stream.get("avg_frame_rate"),
        "codec": stream.get("codec_name"),
        "pixelFormat": stream.get("pix_fmt"),
        "frames": int(stream["nb_frames"]) if stream.get("nb_frames", "").isdigit() else None,
        "chapters": [
            {"start": float(chapter["start_time"]), "end": float(chapter["end_time"]),
             "title": chapter.get("tags", {}).get("title", "")}
            for chapter in result.get("chapters", [])
        ],
    }


def absolute_path(value: object, field: str) -> Path:
    if not isinstance(value, str) or not Path(value).is_absolute():
        raise ValueError(f"{field} must be an absolute path")
    return Path(value).resolve()


def read_manifest(path: Path) -> tuple[Path, Path, dict, list[Scene]]:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    raw = absolute_path(manifest.get("rawVideo"), "rawVideo")
    if not raw.is_file():
        raise ValueError(f"Recording does not exist: {raw}")
    output = absolute_path(manifest.get("outputDir"), "outputDir")
    if raw == output / "SunbaeHub-full-demo.mp4":
        raise ValueError("rawVideo must not be the output video")
    viewport = manifest.get("viewport", {})
    if not all(isinstance(viewport.get(key), int) and viewport[key] > 0 for key in ("width", "height")):
        raise ValueError("viewport must contain positive integer width and height")
    entries = manifest.get("scenes")
    if not isinstance(entries, list) or not entries:
        raise ValueError("scenes must be a nonempty list")
    scenes = []
    for index, entry in enumerate(entries, start=1):
        if not isinstance(entry, dict):
            raise ValueError(f"Scene {index} must be an object")
        title, caption = entry.get("title"), entry.get("caption")
        if not isinstance(title, str) or not title.strip():
            raise ValueError(f"Scene {index} requires a title")
        if not isinstance(caption, str) or not caption.strip():
            raise ValueError(f"Scene {index} requires a caption")
        start, end = float(entry["start"]), float(entry["end"])
        if not math.isfinite(start) or not math.isfinite(end) or start < 0 or end <= start:
            raise ValueError(f"Scene {index} has invalid start/end times")
        frames = round((end - start) * FPS)
        if frames < 1:
            raise ValueError(f"Scene {index} is shorter than one video frame")
        scene_raw = absolute_path(entry["rawVideo"], f"Scene {index} rawVideo") if "rawVideo" in entry else raw
        scenes.append(Scene(title.strip(), caption.strip(), start, end, frames, scene_raw))
    for source in {scene.raw_video for scene in scenes}:
        if not source.is_file():
            raise ValueError(f"Recording does not exist: {source}")
        if source == output / "SunbaeHub-full-demo.mp4":
            raise ValueError("A scene rawVideo must not be the output video")
    return raw, output, viewport, scenes


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    # Apple SD Gothic Neo includes Hangul as well as Latin and numerals.
    # Its public Regular and Bold faces are indices 0 and 6 in the collection.
    return ImageFont.truetype(str(KOREAN_FONT), size=size, index=6 if bold else 0)


def wrap(text: str, draw: ImageDraw.ImageDraw, typeface: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in text.splitlines():
        line = ""
        for word in paragraph.split():
            if draw.textlength(word, font=typeface) > width:
                raise ValueError(f"Caption word is too wide: {word!r}")
            candidate = f"{line} {word}" if line else word
            if line and draw.textlength(candidate, font=typeface) > width:
                lines.append(line)
                line = word
            else:
                line = candidate
        if line:
            lines.append(line)
    return lines


def caption_overlay(scene: Scene, index: int, total: int, path: Path) -> None:
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rectangle((0, UI_HEIGHT, WIDTH, HEIGHT), fill=(*BACKGROUND, 255))
    draw.line((UI_X, UI_HEIGHT + 1, WIDTH - UI_X, UI_HEIGHT + 1), fill=(56, 66, 83, 255), width=1)
    title_font, caption_font = font(20, bold=True), font(28)
    title = f"{index:02d} / {total:02d}   {scene.title}"
    if draw.textlength(title, font=title_font) > UI_WIDTH:
        raise ValueError(f"Scene title is too long: {scene.title}")
    lines = wrap(scene.caption, draw, caption_font, UI_WIDTH)
    if len(lines) > 2:
        raise ValueError(f"Scene {index} caption exceeds two readable lines; shorten it")
    draw.text((UI_X, 983), title, font=title_font, fill=(160, 207, 229, 255), anchor="lt")
    first_line_y = 1011 if len(lines) == 2 else 1016
    for line_index, line in enumerate(lines):
        draw.text((UI_X, first_line_y + 32 * line_index), line,
                  font=caption_font, fill=(244, 246, 250, 255), anchor="lt")
    overlay.save(path)


def render_clip(ffmpeg: str, raw: Path, overlay: Path, output: Path, scene: Scene) -> None:
    # Contain the image to preserve every source pixel, including if the raw
    # recorder dimensions differ from the requested 16:9 viewport.
    filters = (
        f"[0:v]scale={UI_WIDTH}:{UI_HEIGHT}:force_original_aspect_ratio=decrease:flags=lanczos,"
        f"pad={UI_WIDTH}:{UI_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0x101522,"
        f"setsar=1,fps={FPS},setpts=PTS-STARTPTS,"
        f"pad={WIDTH}:{HEIGHT}:{UI_X}:0:color=0x101522[base];"
        "[base][1:v]overlay=0:0:shortest=1,format=yuv420p[video]"
    )
    run([
        ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
        "-ss", f"{scene.start:.6f}", "-i", str(raw),
        "-loop", "1", "-framerate", str(FPS), "-i", str(overlay),
        "-filter_complex_threads", "1", "-filter_complex", filters,
        "-map", "[video]", "-an", "-frames:v", str(scene.frames),
        "-t", f"{scene.duration:.6f}", "-c:v", "libx264",
        "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-r", str(FPS), "-threads", "2", "-video_track_timescale", "15360",
        "-movflags", "+faststart", str(output),
    ])


def timestamp(seconds: float, srt: bool = False) -> str:
    milliseconds = round(seconds * 1000)
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds_part, millis = divmod(remainder, 1000)
    separator = "," if srt else "."
    return f"{hours:02d}:{minutes:02d}:{seconds_part:02d}{separator}{millis:03d}"


def write_timelines(scenes: list[Scene], output: Path) -> None:
    subtitles, chapters = [], ["# 선배허브 시연 영상 목차", "", "모든 시간은 완성된 영상 기준입니다.", ""]
    elapsed_frames = 0
    for index, scene in enumerate(scenes, start=1):
        start = elapsed_frames / FPS
        elapsed_frames += scene.frames
        end = elapsed_frames / FPS
        subtitles.append(f"{index}\n{timestamp(start, True)} --> {timestamp(end, True)}\n"
                         f"{scene.title}\n{scene.caption}\n")
        chapters.append(f"- **{timestamp(start)}–{timestamp(end)} · {scene.title}** — {scene.caption}")
    (output / "SunbaeHub-full-demo.srt").write_text("\n".join(subtitles), encoding="utf-8")
    (output / "chapters.md").write_text("\n".join(chapters) + "\n", encoding="utf-8")


def write_chapter_metadata(scenes: list[Scene], path: Path) -> None:
    def escape(value: str) -> str:
        return "".join("\\" + char if char in "\\=;#\n\r" else char for char in value)

    lines = [";FFMETADATA1", "title=선배허브 전체 기능 시연", ""]
    elapsed_frames = 0
    for scene in scenes:
        start_ms = round(elapsed_frames * 1000 / FPS)
        elapsed_frames += scene.frames
        end_ms = round(elapsed_frames * 1000 / FPS)
        lines.extend(["[CHAPTER]", "TIMEBASE=1/1000", f"START={start_ms}",
                      f"END={end_ms}", f"title={escape(scene.title)}", ""])
    path.write_text("\n".join(lines), encoding="utf-8")


def validate_chapters(scenes: list[Scene], chapters: list[dict]) -> None:
    if len(chapters) != len(scenes):
        raise RuntimeError(f"Chapter count mismatch: expected {len(scenes)}; got {len(chapters)}")
    elapsed_frames = 0
    for index, (scene, chapter) in enumerate(zip(scenes, chapters), start=1):
        expected_start = round(elapsed_frames * 1000 / FPS) / 1000
        elapsed_frames += scene.frames
        expected_end = round(elapsed_frames * 1000 / FPS) / 1000
        if (abs(chapter["start"] - expected_start) > 0.002
                or abs(chapter["end"] - expected_end) > 0.002
                or chapter["title"] != scene.title):
            raise RuntimeError(f"Chapter {index} mismatch: expected {expected_start}–{expected_end} "
                               f"{scene.title!r}; got {chapter}")


def contact_sheet(ffmpeg: str, video: Path, duration: float, output: Path) -> Path:
    thumbnails = output / "thumbnails"
    thumbnails.mkdir(exist_ok=True)
    tiles = []
    times = [duration * (index + 0.5) / 8 for index in range(8)]
    for index, sample in enumerate(times, start=1):
        path = thumbnails / f"frame-{index:02d}.png"
        run([
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{sample:.6f}",
            "-i", str(video), "-frames:v", "1", "-vf", "scale=640:360", str(path),
        ])
        with Image.open(path) as image:
            tiles.append(image.convert("RGB"))
    sheet = Image.new("RGB", (1280, 4 * 396), BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    for index, (tile, sample) in enumerate(zip(tiles, times)):
        x, y = (index % 2) * 640, (index // 2) * 396
        sheet.paste(tile, (x, y))
        draw.text((x + 12, y + 369), timestamp(sample), font=font(17), fill=(244, 246, 250), anchor="lt")
    target = output / "contact-sheet.jpg"
    sheet.save(target, quality=93)
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("manifest", type=Path)
    args = parser.parse_args()
    raw, output, viewport, scenes = read_manifest(args.manifest)
    ffmpeg, ffprobe = find_binary("ffmpeg"), find_binary("ffprobe")
    source_paths = list(dict.fromkeys([raw, *(scene.raw_video or raw for scene in scenes)]))
    sources = {source: probe(ffprobe, source) for source in source_paths}
    source_info = sources[raw]
    for index, scene in enumerate(scenes, start=1):
        scene_source = scene.raw_video or raw
        duration = sources[scene_source]["duration"]
        if duration is not None and scene.end > duration + 1 / FPS:
            raise ValueError(f"Scene {index} ends after its source recording: {scene_source}")
    for source, details in sources.items():
        if (details["width"], details["height"]) != (viewport["width"], viewport["height"]):
            print(f"Notice: {source.name} dimensions differ from viewport; preserving the complete recorded frame.", flush=True)
    output.mkdir(parents=True, exist_ok=True)
    intermediate = output / "render-assets"
    intermediate.mkdir(exist_ok=True)
    paths = []
    for index, scene in enumerate(scenes, start=1):
        overlay = intermediate / f"caption-{index:03d}.png"
        clip = intermediate / f"clip-{index:03d}.mp4"
        caption_overlay(scene, index, len(scenes), overlay)
        paths.append((scene, overlay, clip))
    print(f"Rendering {len(scenes)} clips with at most two encoders...", flush=True)
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {
            pool.submit(render_clip, ffmpeg, scene.raw_video or raw, overlay, clip, scene): index
            for index, (scene, overlay, clip) in enumerate(paths, start=1)
        }
        for future in as_completed(futures):
            future.result()
            print(f"Rendered clip {futures[future]}/{len(scenes)}", flush=True)
    # Names are generated locally and relative to this file, so concat syntax
    # does not need to interpolate or shell-escape user-controlled paths.
    concat_file = intermediate / "clips.txt"
    concat_file.write_text("".join(f"file '{clip.name}'\n" for _, _, clip in paths), encoding="utf-8")
    chapter_metadata = intermediate / "chapters.ffmetadata"
    write_chapter_metadata(scenes, chapter_metadata)
    video = output / "SunbaeHub-full-demo.mp4"
    run([
        ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "1",
        "-i", str(concat_file), "-f", "ffmetadata", "-i", str(chapter_metadata),
        "-map", "0:v:0", "-map_metadata", "1", "-map_chapters", "1", "-an",
        "-c", "copy", "-movflags", "+faststart", str(video),
    ])
    info = probe(ffprobe, video)
    expected_frames = sum(scene.frames for scene in scenes)
    expected_duration = expected_frames / FPS
    if (info["width"], info["height"]) != (WIDTH, HEIGHT):
        raise RuntimeError(f"Unexpected output dimensions: {info}")
    if info["duration"] is None or abs(info["duration"] - expected_duration) > max(0.15, len(scenes) / FPS):
        raise RuntimeError(f"Duration mismatch: expected {expected_duration:.3f}s; got {info['duration']}")
    if info["frames"] is not None and info["frames"] != expected_frames:
        raise RuntimeError(f"Frame count mismatch: expected {expected_frames}; got {info['frames']}")
    if info["codec"] != "h264" or info["pixelFormat"] != "yuv420p":
        raise RuntimeError(f"Unexpected output encoding: {info}")
    validate_chapters(scenes, info["chapters"])
    write_timelines(scenes, output)
    sheet = contact_sheet(ffmpeg, video, info["duration"], output)
    report = {"video": str(video), "source": source_info, "output": info,
              "expectedDuration": expected_duration, "expectedFrames": expected_frames,
              "sceneCount": len(scenes), "chaptersValidated": len(info["chapters"]),
              "contactSheet": str(sheet)}
    if len(sources) > 1:
        report["additionalSources"] = [
            {"rawVideo": str(source), **details}
            for source, details in sources.items() if source != raw
        ]
    (output / "validation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, KeyError, RuntimeError, OSError) as error:
        print(f"Rendering failed: {error}", file=sys.stderr)
        raise SystemExit(1)
