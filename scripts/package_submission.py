from pathlib import Path
import zipfile
root=Path(__file__).resolve().parents[1]
files=[root/name for name in ['README.md','SOURCE_NOTICE.md','requirements.txt','requirements-dev.txt','.gitignore']]
for directory in ['backend/app','frontend/src','frontend/public','tests','scripts']:
 p=root/directory
 if p.exists():files += [f for f in p.rglob('*') if f.is_file() and '__pycache__' not in f.parts and f.suffix not in ('.pyc','.pyo')]
files += [root/'backend/data'/name for name in ['neighborhood.json','groundsource_verified_florida.geojson']]
files += [f for f in (root/'frontend').iterdir() if f.is_file() and not f.name.startswith('.env')]
files += [root/'docs/verified-groundsource.md']
files += [f for f in (root/'submission').iterdir() if f.is_file() and f.suffix=='.md']
files += [root/'submission/place-name-search.png']
out=root/'submission/RippleEffectAI_Source.zip'
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
 for f in sorted(set(files)):archive.write(f,str(f.relative_to(root)))
with zipfile.ZipFile(out) as archive:
 assert archive.testzip() is None
 assert 'backend/data/groundsource_verified_florida.geojson' in archive.namelist()
 assert 'backend/data/groundsource_subset.geojson' not in archive.namelist()
 assert not any('node_modules' in name or name.startswith('scratch/') for name in archive.namelist())
 print('Verified submission package:',len(archive.namelist()),'files;',round(out.stat().st_size/1e6,2),'MB')
