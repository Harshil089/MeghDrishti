# ASCII art for the backdrop

`src/components/ascii/art.ts` is generated, not hand-written:

1. `make_sources.py` draws black-on-white source images from MeghDrishti data
   (`overview.json` from `GET /api/v1/stations/overview`, `trace.json` with one station's
   observations). Needs `numpy matplotlib scipy opencv-python-headless`.
2. Each image is converted with [vietnh1009/ASCII-generator](https://github.com/vietnh1009/ASCII-generator):
   `python img2txt.py --input india_stations.png --output out.txt --mode simple --num_cols 56`
3. The text is pasted into `art.ts` (blank top/bottom rows trimmed).

Images are stretched 1.2x vertically before conversion because the console's glyph cells
are 1.67:1 while `img2txt.py` assumes 2:1.
