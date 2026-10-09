"""Build local demonstration films from the repository's existing illustration assets.
Run: uv run --with imageio-ffmpeg python scripts/generate-demo-media.py
No model, remote media, or credentials are used.
"""
from pathlib import Path
import subprocess
import imageio_ffmpeg

root = Path(__file__).resolve().parents[1]
media = root / 'frontend/public'
out = media / 'demo'
out.mkdir(exist_ok=True)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
for filename, frames in [('mujian-film.mp4', ['space', 'detective', 'ink', 'space']), ('mujian-alternate.mp4', ['mars', 'space', 'ink', 'mars'])]:
    args = [ffmpeg, '-y', '-hide_banner', '-loglevel', 'error']
    for name, duration in zip(frames, [8, 7, 8, 7]):
        args += ['-loop', '1', '-t', str(duration), '-i', str(media / ('ui/inspiration-' + name + '.png'))]
    filters = []
    for i in range(4):
        filters.append('['+str(i)+':v]scale=1600:1000,zoompan=z=min(zoom+0.00012\\,1.1):x=iw/2-iw/zoom/2:y=ih/2-ih/zoom/2:d=1:s=1280x720:fps=24,setsar=1[v'+str(i)+']')
    filters.append('[v0][v1][v2][v3]concat=n=4:v=1:a=0[v]')
    args += ['-filter_complex', ';'.join(filters), '-map', '[v]', '-t', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(out / filename)]
    subprocess.run(args, check=True)
    print(filename, (out / filename).stat().st_size)
