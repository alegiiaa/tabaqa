import zipfile, re, sys
from xml.etree import ElementTree as ET

NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}

def load(path):
    z=zipfile.ZipFile(path)
    wb=ET.fromstring(z.read('xl/workbook.xml'))
    rels=ET.fromstring(z.read('xl/_rels/xl/workbook.xml.rels'.replace('xl/_rels/xl/','xl/_rels/')))
    relmap={r.get('Id'):r.get('Target') for r in rels}
    sheets={}
    for s in wb.find('m:sheets',NS):
        rid=s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        t=relmap[rid]
        sheets[s.get('name')]= t if t.startswith('xl/') else 'xl/'+t
    ss=[]
    try:
        sroot=ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in sroot:
            ss.append(''.join(t.text or '' for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')))
    except KeyError: pass
    return z, sheets, ss

def colnum(ref):
    m=re.match(r'([A-Z]+)',ref); n=0
    for ch in m.group(1): n=n*26+ord(ch)-64
    return n

def readsheet(z, path, ss):
    root=ET.fromstring(z.read(path))
    rows={}
    for row in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
        rn=int(row.get('r'))
        cells={}
        for c in row:
            ref=c.get('r'); t=c.get('t')
            v=c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
            if v is None:
                isv=c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}is')
                val=''.join(x.text or '' for x in isv.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')) if isv is not None else None
            else:
                val=ss[int(v.text)] if t=='s' else v.text
            if val is not None: cells[colnum(ref)]=val
        rows[rn]=cells
    return rows

if __name__=='__main__':
    path, sheet = sys.argv[1], sys.argv[2]
    rowspec = sys.argv[3] if len(sys.argv)>3 else '1-40'
    a,b=map(int,rowspec.split('-'))
    z,sheets,ss=load(path)
    rows=readsheet(z,sheets[sheet],ss)
    maxr=max(rows) if rows else 0
    print(f'sheet {sheet}: {maxr} rows')
    for rn in sorted(rows):
        if a<=rn<=b:
            cells=rows[rn]
            line=' | '.join(f'{c}:{str(cells[c]).strip()[:28]}' for c in sorted(cells) if str(cells[c]).strip())
            if line: print(rn, line)
