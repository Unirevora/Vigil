"""Build a temporary, in-memory browser QA fixture from the real multi-file app.
Not a distribution format; production is always the modular source tree.
"""
from pathlib import Path
import re,base64,json
ROOT=Path(__file__).resolve().parents[1]

def ordered_modules(entry='src/main.js'):
    order=[];seen=set()
    def visit(rel):
        if rel in seen:return
        seen.add(rel)
        source=(ROOT/rel).read_text(encoding='utf-8')
        for imp in re.findall(r"(?ms)^import\s+.*?\s+from\s+['\"]([^'\"]+)['\"];?",source):
            if not imp.startswith('.'):continue
            if '/vendor/' in imp:continue
            child=(Path(rel).parent/imp).as_posix()
            # normalize relative path on POSIX
            import posixpath
            child=posixpath.normpath(child)
            if (ROOT/child).exists():visit(child)
        order.append(rel)
    visit(entry)
    return order

def fixture():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    styles=re.findall(r'<link rel="stylesheet" href="/([^"]+)">',html)
    css='\n'.join((ROOT/file).read_text(encoding='utf-8') for file in styles)
    # Absolute /assets URLs are not fetchable in about:blank; embed only for QA.
    for path in sorted(set(re.findall(r'''url\(["']?(/assets/[^)"']+)''',css))):
        resource=ROOT/path.lstrip('/')
        if not resource.is_file():continue
        mime={'.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'}.get(resource.suffix)
        if mime:
            data=f'data:{mime};base64,'+base64.b64encode(resource.read_bytes()).decode('ascii')
            css=css.replace(path,data)
    html=re.sub(r'<link rel="stylesheet" href="/[^"]+">','',html)
    html=html.replace('</head>','<style>'+css+'</style></head>')
    html=html.replace('src="/assets/typewriter-still-life.webp"',
        'src="data:image/webp;base64,'+base64.b64encode((ROOT/'assets/typewriter-still-life.webp').read_bytes()).decode('ascii')+'"')
    # Logo artwork must remain visible in offline screenshots, too.
    mark='data:image/svg+xml;base64,'+base64.b64encode((ROOT/'assets/vigil-mark.svg').read_bytes()).decode('ascii')
    html=html.replace('/assets/vigil-mark.svg',mark)
    # Classic CodeMirror vendor scripts.
    def classic(path):
        contents=(ROOT/path).read_text(encoding='utf-8')
        return '<script>'+contents.replace('</script','<\\/script')+'</script>'
    for path in ['vendor/codemirror/codemirror.js','vendor/codemirror/markdown.js',
                  'vendor/codemirror/continuelist.js']:
        html=html.replace(f'<script src="/{path}"></script>',classic(path))
    katex=(ROOT/'vendor/katex/katex.mjs').read_text(encoding='utf-8')
    katex=re.sub(r'export\{[^}]+\};?\s*$', 'const __katex=d4;',katex)
    code=['const __modules=Object.create(null);']
    for file in ordered_modules():
        source=(ROOT/file).read_text(encoding='utf-8')
        exports=re.findall(r'(?m)^export\s+(?:const|let|class|function|async\s+function)\s+([A-Za-z_$][A-Za-z0-9_$]*)',source)
        import posixpath
        def rewrite_import(match):
            spec=match.group(1).strip()
            dependency=match.group(2)
            if dependency.endswith('/vendor/katex/katex.mjs'):
                return f'const {spec}=__katex;'
            resolved=posixpath.normpath(posixpath.join(posixpath.dirname(file),dependency))
            if spec.startswith('{'):
                parts=[]
                for field in spec[1:-1].split(','):
                    field=field.strip()
                    if not field:continue
                    bits=re.split(r'\s+as\s+',field)
                    parts.append(bits[0] if len(bits)==1 else bits[0]+':'+bits[1])
                return 'const {'+','.join(parts)+'}=__modules['+json.dumps(resolved)+'];'
            return f'const {spec}=__modules['+json.dumps(resolved)+'].default;'
        source=re.sub(r'(?ms)^import\s+([\s\S]*?)\s+from\s+[\'\"]([^\'\"]+)[\'\"];?[ \t]*\n',rewrite_import,source)
        source=re.sub(r'\bexport\s+(?=(?:const|let|function|class|async)\b)','',source)
        code.append('// '+file+'\n__modules['+json.dumps(file)+']=(()=>{\n'+source+'\nreturn {'+','.join(exports)+'};\n})();')
    # The mocked storage mimics localStorage across DOM content only.
    storage='''const __storage={};Object.defineProperty(window,'localStorage',{configurable:true,value:{
      getItem:k=>Object.hasOwn(__storage,k)?__storage[k]:null,
      setItem:(k,v)=>{__storage[k]=String(v);},removeItem:k=>{delete __storage[k];}
    }});'''
    bundle=katex+'\n'+storage+'\n'+'\n'.join(code)
    # The production app resolves this through /assets. The about:blank QA
    # fixture has no origin, so inline only this preview's static illustration.
    hero='data:image/webp;base64,'+base64.b64encode((ROOT/'assets/typewriter-still-life.webp').read_bytes()).decode('ascii')
    bundle=bundle.replace('/assets/typewriter-still-life.webp',hero)
    bundle=bundle.replace('/assets/vigil-mark.svg',mark)
    html=html.replace('<script type="module" src="/src/main.js"></script>',
                      '<script>'+bundle.replace('</script','<\\/script')+'</script>')
    return html,bundle,ordered_modules()

if __name__=='__main__':
    import subprocess
    html,js,modules=fixture()
    p=Path('/mnt/data/vigil-editor-151-qa.html')
    p.write_text(html,encoding='utf-8')
    Path('/mnt/data/vigil-editor-151-bundle.js').write_text(js,encoding='utf-8')
    syntax=subprocess.run(['node','--check','/mnt/data/vigil-editor-151-bundle.js'],text=True,capture_output=True)
    print('QA HTML bytes',p.stat().st_size,'modules',len(modules),'node syntax',syntax.returncode)
    print('node message',syntax.stderr[:450])
