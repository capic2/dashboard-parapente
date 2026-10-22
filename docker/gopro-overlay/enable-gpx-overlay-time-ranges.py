import sys
from pathlib import Path


arguments_path = Path(sys.argv[1])
source = arguments_path.read_text(encoding="utf-8")
old_guard = (
    '    if args.use_gpx_only and args.generate != "default":\n'
    '        quit("--generate cannot be combined with --use-gpx-only")'
)
new_guard = (
    '    if args.use_gpx_only and args.generate != "default" and (\n'
    '        args.generate != "overlay" or not args.input\n'
    '    ):\n'
    '        quit("--use-gpx-only supports --generate overlay only with an input video")'
)

if new_guard in source:
    raise SystemExit("GPX overlay time-range support is already enabled")
if source.count(old_guard) != 1:
    raise SystemExit("Unable to find the expected GPX-only --generate guard")

arguments_path.write_text(source.replace(old_guard, new_guard, 1), encoding="utf-8")
