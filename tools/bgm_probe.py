# 내려받은 악구의 길이·음량·앞뒤 무음을 잰다(곡 고르기용)
import json, os, subprocess, sys, io, re, shutil
BIN = os.path.dirname(shutil.which('ffmpeg') or os.path.expanduser('~/ffmpeg/bin/ffmpeg.exe'))
FFMPEG, FFPROBE = os.path.join(BIN, 'ffmpeg'), os.path.join(BIN, 'ffprobe')
sys.stdout.reconfigure(encoding='utf-8')
RAW = os.path.join(os.path.dirname(__file__), '..', 'assets', 'raw', 'bgm')
picks = json.load(io.open(os.path.join(RAW, 'picks.json'), encoding='utf-8'))
files = os.listdir(RAW)


def probe(f):
    p = os.path.join(RAW, f)
    info = json.loads(subprocess.run([FFPROBE, '-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', p], capture_output=True, text=True, encoding='utf-8', errors='replace').stdout)
    st = info['streams'][0]
    dur = float(info['format']['duration'])
    # 음량(LUFS)과 앞뒤 무음
    r = subprocess.run([FFMPEG, '-hide_banner', '-nostats', '-i', p, '-af', 'ebur128=peak=true,silencedetect=n=-45dB:d=0.3', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
    lufs = re.findall(r'I:\s+(-?[\d.]+) LUFS', r)
    peak = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r)
    sil = re.findall(r'silence_(start|end): (-?[\d.]+)', r)
    return {'dur': round(dur, 2), 'sr': st['sample_rate'], 'ch': st['channels'], 'lufs': float(lufs[-1]) if lufs else None, 'peak': float(peak[-1]) if peak else None, 'sil': [(a, round(float(b), 2)) for a, b in sil][:6]}


for p in picks:
    f = next((x for x in files if x.lower().startswith(p['id'].lower())), None)
    p['file'] = f
    if f: p.update(probe(f))
    print(p['track'], p['instr'], p['comp'], p['name'], f, p.get('dur'), p.get('lufs'), p.get('peak'), p.get('sil'))
json.dump(picks, io.open(os.path.join(RAW, 'probe.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
