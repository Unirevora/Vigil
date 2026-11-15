import {icon} from './icons.js';

/** Offline command palette: functional navigation and searchable local notes.
 *  Uses textContent for user-supplied titles; no HTML injection.
 */
export function mountCommandPalette({getItems,onSelect}){
  const layer=document.querySelector('#commandLayer');
  const input=document.querySelector('#commandInput');
  const results=document.querySelector('#commandResults');
  if(!layer||!input||!results)throw new Error('Command palette DOM is missing');
  let previous=null,visible=[],selected=0,allItems=[];
  const isOpen=()=>!layer.hidden;

  function renderItems(){
    const query=input.value.trim().toLocaleLowerCase();
    const matched=allItems.filter(item=>{
      const haystack=`${item.title} ${item.hint||''} ${item.keywords||''}`.toLocaleLowerCase();
      return !query||haystack.includes(query);
    });
    // A bounded list avoids jank for thousands of notes.
    visible=matched.slice(0,11);
    selected=0;
    results.replaceChildren();
    if(!visible.length){
      input.removeAttribute('aria-activedescendant');
      const empty=document.createElement('div');
      empty.className='command-empty';empty.textContent='没有找到匹配的手记或操作';
      results.append(empty);return;
    }
    for(let i=0;i<visible.length;i++){
      const item=visible[i];
      const row=document.createElement('button');
      row.type='button';
      row.className='command-result';
      row.id=`command-result-${i}`;
      row.setAttribute('role','option');
      row.setAttribute('aria-selected',String(i===selected));
      if(i===selected)row.classList.add('active');
      const iconBox=document.createElement('span');
      iconBox.className='command-result-icon';iconBox.innerHTML=icon(item.icon||'book');
      const labels=document.createElement('span');labels.className='command-result-labels';
      const title=document.createElement('strong');title.textContent=item.title;
      labels.append(title);
      if(item.hint){
        const hint=document.createElement('small');hint.textContent=item.hint;labels.append(hint);
      }
      const end=document.createElement('span');end.className='command-enter';
      end.textContent=i===selected?'↵':'';
      row.append(iconBox,labels,end);
      row.addEventListener('mouseenter',()=>choose(i));
      row.addEventListener('click',()=>activate(i));
      results.append(row);
    }
    input.setAttribute('aria-activedescendant','command-result-0');
  }
  function choose(index){
    if(!visible.length)return;
    selected=(index+visible.length)%visible.length;
    for(let i=0;i<results.children.length;i++){
      const node=results.children[i];
      node.classList.toggle('active',i===selected);
      node.setAttribute('aria-selected',String(i===selected));
      node.querySelector('.command-enter').textContent=i===selected?'↵':'';
    }
    input.setAttribute('aria-activedescendant',`command-result-${selected}`);
    results.children[selected]?.scrollIntoView({block:'nearest'});
  }
  function close(){
    if(!isOpen())return;
    layer.hidden=true;layer.setAttribute('aria-hidden','true');
    input.value='';results.replaceChildren();allItems=[];
    input.setAttribute('aria-expanded','false');
    input.removeAttribute('aria-activedescendant');
    if(previous?.isConnected)previous.focus();
  }
  function open(){
    if(isOpen()){close();return;}
    if(document.querySelector('#modalLayer.open')||
       !document.querySelector('#passphraseLayer')?.hidden)return;
    previous=document.activeElement;
    layer.hidden=false;layer.setAttribute('aria-hidden','false');
    input.value='';
    allItems=getItems();
    input.setAttribute('aria-expanded','true');
    renderItems();
    input.focus();
  }
  function activate(index=selected){
    const item=visible[index];
    if(!item)return;
    close();
    onSelect(item);
  }
  function keydown(event){
    if(!isOpen())return;
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
    if(event.key==='ArrowDown'){event.preventDefault();choose(selected+1);}
    if(event.key==='ArrowUp'){event.preventDefault();choose(selected-1);}
    if(event.key==='Enter'){event.preventDefault();activate();}
    if(event.key==='Tab'){
      // One primary input; keep focus inside the modal.
      event.preventDefault();input.focus();
    }
  }
  input.addEventListener('input',renderItems);
  layer.addEventListener('click',e=>{if(e.target===layer)close();});
  document.addEventListener('keydown',keydown,true);
  return {open,close,isOpen,refresh:()=>{if(isOpen()){allItems=getItems();renderItems();}}};
}
