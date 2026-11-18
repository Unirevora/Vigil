/** Progressive enhancement of native selects into lightweight accessible menus.
 * Selects remain the source of truth for data binding, while the button and
 * listbox use the same typography, color, and focus ring as the app.
 * No external library. Native select remains available if JS cannot initialize.
 */
let active=null;
let popup=null;
function popupElement(){
  if(popup?.isConnected)return popup;
  popup=document.createElement('div');
  popup.className='vigil-select-popup';
  popup.id='vigilSelectPopup';
  popup.setAttribute('role','listbox');
  popup.hidden=true;
  document.body.append(popup);
  return popup;
}
function selectText(select){
  const option=select.selectedOptions?.[0]||select.options[0];
  return option?.textContent?.trim()||'请选择';
}
function resetAria(trigger){
  if(trigger){trigger.setAttribute('aria-expanded','false');trigger.removeAttribute('aria-activedescendant');}
}
export function closeThemedSelect({returnFocus=false}={}){
  if(!active)return;
  const {trigger}=active;
  active=null;
  popupElement().hidden=true;
  popup.replaceChildren();
  resetAria(trigger);
  if(returnFocus&&trigger?.isConnected)trigger.focus();
}
function positionPopup(){
  if(!active)return;
  const {trigger}=active;
  if(!trigger.isConnected){closeThemedSelect();return;}
  const rect=trigger.getBoundingClientRect();
  const width=Math.min(Math.max(rect.width,180),window.innerWidth-20);
  const height=popup.getBoundingClientRect().height;
  const spaceBelow=window.innerHeight-rect.bottom-10;
  const openAbove=spaceBelow<Math.min(height,180)&&rect.top>spaceBelow+80;
  const left=Math.max(10,Math.min(window.innerWidth-width-10,rect.left));
  const top=openAbove?Math.max(10,rect.top-height-7):Math.min(window.innerHeight-height-10,rect.bottom+7);
  popup.style.left=left+'px';popup.style.top=Math.max(10,top)+'px';popup.style.width=width+'px';
}
function highlight(index){
  if(!active)return;
  const {items,trigger}=active;
  if(!items.length)return;
  const valid=items.filter(x=>!x.disabled);
  if(!valid.length)return;
  let pos=((index%items.length)+items.length)%items.length;
  for(let step=0;step<items.length&&items[pos].disabled;step++)pos=(pos+1)%items.length;
  const item=items[pos];
  active.index=pos;
  for(let i=0;i<items.length;i++){
    const node=popup.children[i];
    node.classList.toggle('is-highlighted',i===active.index);
    node.setAttribute('aria-selected',String(i===active.index));
  }
  trigger.setAttribute('aria-activedescendant',popup.children[active.index].id);
  popup.children[active.index].scrollIntoView({block:'nearest'});
}
function choose(index){
  if(!active)return;
  const {select}=active;
  const option=select.options[index];
  if(!option||option.disabled)return;
  select.value=option.value;
  const trigger=active.trigger;
  trigger.querySelector('.vigil-select-value').textContent=selectText(select);
  closeThemedSelect({returnFocus:true});
  select.dispatchEvent(new Event('input',{bubbles:true}));
  select.dispatchEvent(new Event('change',{bubbles:true}));
}
function open(select,trigger){
  if(active?.trigger===trigger){closeThemedSelect();return;}
  closeThemedSelect();
  const list=popupElement();list.replaceChildren();
  const host=trigger.closest('#settingsLayer')||document.body;
  if(list.parentElement!==host)host.append(list);
  const items=[...select.options];
  active={select,trigger,items,index:Math.max(0,select.selectedIndex)};
  for(let i=0;i<items.length;i++){
    const option=items[i];
    const row=document.createElement('button');row.type='button';row.tabIndex=-1;row.id='vigil-select-opt-'+i;
    row.className='vigil-select-option';row.setAttribute('role','option');
    row.setAttribute('aria-selected',String(i===active.index));
    row.disabled=option.disabled;
    const title=document.createElement('span');title.textContent=option.textContent;
    const tick=document.createElement('span');tick.className='vigil-select-tick';tick.textContent=i===active.index?'✓':'';
    row.append(title,tick);
    row.addEventListener('mouseenter',()=>highlight(i));
    row.addEventListener('click',()=>choose(i));
    list.append(row);
  }
  list.hidden=false;
  trigger.setAttribute('aria-expanded','true');
  highlight(active.index);positionPopup();
}
function keydown(event,select,trigger){
  const key=event.key;
  if(key==='Escape'&&active?.trigger===trigger){event.preventDefault();closeThemedSelect({returnFocus:true});return;}
  if(key==='ArrowDown'||key==='ArrowUp'){
    event.preventDefault();
    if(active?.trigger!==trigger){open(select,trigger);return;}
    let current=active.index;
    for(let i=0;i<active.items.length;i++){
      current=(current+(key==='ArrowDown'?1:-1)+active.items.length)%active.items.length;
      if(!active.items[current].disabled){highlight(current);break;}
    }
    return;
  }
  if(key==='Home'||key==='End'){
    if(active?.trigger!==trigger)return;
    event.preventDefault();
    const index=key==='Home'?active.items.findIndex(x=>!x.disabled):active.items.findLastIndex(x=>!x.disabled);
    if(index>=0)highlight(index);return;
  }
  if(key==='Enter'||key===' '){event.preventDefault();if(active?.trigger===trigger)choose(active.index);else open(select,trigger);}
  else if(key==='Tab'&&active?.trigger===trigger)closeThemedSelect();
}
let initialized=false;
function globalHandlers(){
  if(initialized)return;initialized=true;
  document.addEventListener('pointerdown',event=>{
    if(active&&!active.trigger.contains(event.target)&&!popup?.contains(event.target))closeThemedSelect();
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&active){event.stopPropagation();event.preventDefault();closeThemedSelect({returnFocus:true});}
  },true);
  window.addEventListener('scroll',()=>{if(active)positionPopup();},{capture:true,passive:true});
  window.addEventListener('resize',()=>{if(active)positionPopup();},{passive:true});
}
export function mountThemedSelects(root=document){
  if(!root?.querySelectorAll)return;
  globalHandlers();
  for(const select of root.querySelectorAll('select:not([data-themed-select])')){
    if(select.multiple||select.size>1)continue;
    select.dataset.themedSelect='1';
    const wrapper=document.createElement('span');wrapper.className='vigil-select-root';
    select.before(wrapper);wrapper.append(select);
    select.classList.add('vigil-native-select');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
    const button=document.createElement('button');button.type='button';button.className='vigil-select-trigger';
    button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');
    button.setAttribute('aria-controls','vigilSelectPopup');button.setAttribute('aria-expanded','false');
    const label=document.querySelector(`label[for="${CSS.escape(select.id)}"]`)?.textContent?.trim()
      ||select.closest('label')?.firstChild?.textContent?.trim()||select.getAttribute('aria-label')||'选择选项';
    button.setAttribute('aria-label',label);
    const value=document.createElement('span');value.className='vigil-select-value';value.textContent=selectText(select);
    const chevron=document.createElement('span');chevron.className='vigil-select-chevron';chevron.setAttribute('aria-hidden','true');chevron.textContent='⌄';
    button.append(value,chevron);wrapper.append(button);
    select.addEventListener('change',()=>{value.textContent=selectText(select);});
    button.addEventListener('click',()=>open(select,button));
    button.addEventListener('keydown',event=>keydown(event,select,button));
    const associated=select.id?document.querySelector(`label[for="${CSS.escape(select.id)}"]`):null;
    const containing=select.closest('label');
    for(const labelElement of [associated,containing]){
      if(!labelElement)continue;
      labelElement.addEventListener('click',event=>{
        if(wrapper.contains(event.target))return;
        event.preventDefault();button.focus();open(select,button);
      });
    }
    if(select.disabled)button.disabled=true;
  }
}
