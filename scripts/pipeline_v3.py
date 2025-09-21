# pipeline_v3.py (condensed working version)
import argparse, os, json, subprocess, tempfile
from pathlib import Path
import requests, fitz
OPENAI_API_KEY=os.getenv("OPENAI_API_KEY"); ELEVEN_API_KEY=os.getenv("ELEVENLABS_API_KEY")
def read_pdf_text(pdf,max_chars=6000):
    doc=fitz.open(pdf); t="\n\n".join([p.get_text().strip() for p in doc if p.get_text().strip()]); return t[:max_chars]
def openai_script(text,model="gpt-4o"):
    assert OPENAI_API_KEY, "OPENAI_API_KEY missing"
    r=requests.post("https://api.openai.com/v1/chat/completions",
        headers={"Authorization":f"Bearer {OPENAI_API_KEY}","Content-Type":"application/json"},
        json={"model":model,"messages":[{"role":"system","content":"You are concise."},{"role":"user","content":f"Create 12–20 short narration sentences from:\n{text}"}],"temperature":0.4},timeout=120)
    r.raise_for_status(); return r.json()["choices"][0]["message"]["content"].strip()
def split_script(s,n):
    tokens=[]; 
    for ln in [x.strip() for x in s.splitlines() if x.strip()]:
        for p in ln.replace("•"," ").split("."):
            p=p.strip(); 
            if p: tokens.append(p+".")
    if not tokens: tokens=[s]
    seg=[[] for _ in range(n)]; 
    for i,t in enumerate(tokens): seg[i% n].append(t)
    return [" ".join(x) for x in seg]
def tts_eleven(text,out,voice="21m00Tcm4TlvDq8ikWAM"):
    assert ELEVEN_API_KEY, "ELEVENLABS_API_KEY missing"
    with requests.post(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}",
        headers={"xi-api-key":ELEVEN_API_KEY,"accept":"audio/mpeg","content-type":"application/json"},
        json={"text":text,"model_id":"eleven_turbo_v2","voice_settings":{"stability":0.4,"similarity_boost":0.7}},
        stream=True, timeout=240) as r:
        r.raise_for_status()
        with open(out,"wb") as f:
            for ch in r.iter_content(8192):
                if ch: f.write(ch)
def ffmpeg_seg(ffmpeg,img,aud,out):
    p=subprocess.run([ffmpeg,"-y","-loop","1","-i",img,"-i",aud,"-c:v","libx264","-tune","stillimage","-c:a","aac","-b:a","192k","-shortest",out])
    if p.returncode!=0:
        p2=subprocess.run([ffmpeg,"-y","-loop","1","-i",img,"-i",aud,"-c:v","mpeg4","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-shortest",out])
        if p2.returncode!=0: raise SystemExit("FFmpeg failed")
def concat(ffmpeg,files,out,re=False):
    import tempfile
    with tempfile.NamedTemporaryFile("w",delete=False,suffix=".txt") as f:
        for p in files: f.write(f"file '{p}'\n"); lst=f.name
    p=subprocess.run([ffmpeg,"-y","-f","concat","-safe","0","-i",lst,"-c","copy",out])
    if p.returncode!=0 and re:
        p2=subprocess.run([ffmpeg,"-y","-f","concat","-safe","0","-i",lst,"-c:v","libx264","-c:a","aac",out])
        if p2.returncode!=0: raise SystemExit("Concat failed")
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--pdf",required=True); ap.add_argument("--images",required=True)
    ap.add_argument("--output",required=True); ap.add_argument("--vehicle",required=True)
    ap.add_argument("--model",default="gpt-4o"); ap.add_argument("--ffmpeg",required=True)
    a=ap.parse_args(); out=Path(a.output); out.mkdir(parents=True,exist_ok=True)
    imgs=[x.strip().strip('"') for x in a.images.replace(";",
",").split(",") if x.strip()]
    print("[v3] Extract…"); text=read_pdf_text(a.pdf)
    print("[v3] Script…"); script=openai_script(text, a.model); (out/f"{a.vehicle}_script.txt").write_text(script,encoding="utf-8")
    segs=split_script(script,len(imgs)); mp3s=[]; mp4s=[]
    for i,(img,seg) in enumerate(zip(imgs,segs),start=1):
        sid=f"{i:02d}"; aud=str(out/f"{a.vehicle}_seg{sid}.mp3"); vid=str(out/f"{a.vehicle}_seg{sid}.mp4")
        print(f"[v3] TTS {sid}"); tts_eleven(seg,aud)
        print(f"[v3] VID {sid}"); ffmpeg_seg(a.ffmpeg,img,aud,vid); mp3s.append(aud); mp4s.append(vid)
    print("[v3] Concat…"); concat(a.ffmpeg, mp4s, str(out/f"{a.vehicle}_video.mp4"), re=True); concat(a.ffmpeg, mp3s, str(out/f"{a.vehicle}_audio.mp3"), re=True)
    print("[v3] Done")
if __name__=="__main__": main()
