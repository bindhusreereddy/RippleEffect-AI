import urllib.request, json, time, hashlib
from pathlib import Path
base=Path(__file__).resolve().parents[1]/'scratch'
base.mkdir(exist_ok=True)
record=json.load(urllib.request.urlopen('https://zenodo.org/api/records/18647054', timeout=30))
(base/'groundsource-zenodo-record.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
item=next(f for f in record['files'] if f['key'].endswith('.parquet'))
print(json.dumps({'key':item['key'],'size':item['size'],'checksum':item['checksum'],'url':item['links']['self']}),flush=True)
target=base/item['key']
if target.exists() and target.stat().st_size==item['size']:
 print('Original file already present',flush=True)
else:
 request=urllib.request.Request(item['links']['self'],headers={'User-Agent':'RippleEffectAI-hackathon/1.0'})
 with urllib.request.urlopen(request,timeout=90) as response, target.open('wb') as output:
  total=0;last=time.monotonic()
  while block:=response.read(4*1024*1024):
   output.write(block);total+=len(block)
   if time.monotonic()-last>10: print(f'Downloaded {total/1e6:.1f} MB',flush=True);last=time.monotonic()
hashvalue=hashlib.file_digest(target.open('rb'),'md5').hexdigest()
assert 'md5:'+hashvalue==item['checksum'], 'Original dataset checksum mismatch'
print('Verified original dataset MD5: '+hashvalue,flush=True)
