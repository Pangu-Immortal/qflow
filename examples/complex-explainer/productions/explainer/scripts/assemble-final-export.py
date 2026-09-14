"""Join already-rendered consecutive ranges; preserve video and rebuild one audio stream."""
import argparse
import json
from pathlib import Path
import subprocess
import tempfile
from fractions import Fraction


def run(args):
    subprocess.run(args, check=True)


def duration(path):
    info = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=nb_frames,r_frame_rate', '-of', 'json', str(path)
    ]))['streams'][0]
    return int(info['nb_frames']) / Fraction(info['r_frame_rate'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('parts', nargs='+', type=Path, help='Consecutive rendered parts in playback order')
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    parts = [p.resolve(strict=True) for p in args.parts]
    lengths = [duration(p) for p in parts]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='explainer-join-') as temp:
        temp = Path(temp)
        listing = temp / 'concat.txt'
        listing.write_text(''.join(
            "file '" + str(p).replace("'", "'\\''") + f"'\nduration {float(d):.9f}\n"
            for p, d in zip(parts, lengths)
        ))
        picture = temp / 'picture.mp4'
        run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(listing),
             '-map', '0:v:0', '-an', '-c:v', 'copy', str(picture)])
        command = ['ffmpeg', '-v', 'error', '-y', '-i', str(picture)]
        for p in parts:
            command += ['-i', str(p)]
        # Decode each part separately so each AAC encoder delay is removed before concatenation.
        filters = ';'.join(
            f'[{i}:a:0]atrim=duration={float(d):.9f},asetpts=PTS-STARTPTS[a{i}]'
            for i, d in enumerate(lengths, 1)
        ) + ';' + ''.join(f'[a{i}]' for i in range(1, len(parts) + 1)) + f'concat=n={len(parts)}:v=0:a=1[a]'
        run(command + ['-filter_complex', filters, '-map', '0:v:0', '-map', '[a]',
                       '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', str(args.output)])
    print(args.output.resolve())


if __name__ == '__main__':
    main()
