import {icon} from './icons.js';

let toastTimer;
let activeDialog=null;

export function showToast(message,{error=false}={}) {
  const element=document.querySelector('#toast');
  element.textContent=String(message);
  element.className=`toast show${error ? ' bad' : ''}`;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>element.classList.remove('show'),3500);
}

export function confirmDialog({title,description,confirmText='确认',danger=false}) {
  if(activeDialog) return Promise.resolve(false);
  return new Promise(resolve => {
    const layer=document.querySelector('#modalLayer');
    const confirm=document.querySelector('#modalConfirm');
    const cancel=document.querySelector('#modalCancel');
    const focusBefore=document.activeElement;
    document.querySelector('#modalIcon').innerHTML=icon(danger?'alert':'info');
    document.querySelector('#modalTitle').textContent=title;
    document.querySelector('#modalDesc').textContent=description;
    confirm.textContent=confirmText;
    confirm.className=`btn ${danger?'btn-warm':'btn-primary'}`;
    layer.classList.add('open');
    layer.setAttribute('aria-hidden','false');

    const finish = answer => {
      layer.classList.remove('open');
      layer.setAttribute('aria-hidden','true');
      confirm.removeEventListener('click',onConfirm);
      cancel.removeEventListener('click',onCancel);
      layer.removeEventListener('click',onBackdrop);
      document.removeEventListener('keydown',onKeydown,true);
      activeDialog=null;
      if(focusBefore?.isConnected) focusBefore.focus();
      resolve(answer);
    };
    const onConfirm=()=>finish(true);
    const onCancel=()=>finish(false);
    const onBackdrop=e=>{if(e.target===layer)finish(false);};
    const onKeydown=e=>{
      if(e.key==='Escape'){e.preventDefault();finish(false);}
      if(e.key==='Tab') {
        // Keep focus within the two action buttons.
        const buttons=[cancel,confirm];
        const idx=buttons.indexOf(document.activeElement);
        e.preventDefault();
        buttons[(idx+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus();
      }
    };
    activeDialog={finish};
    confirm.addEventListener('click',onConfirm);
    cancel.addEventListener('click',onCancel);
    layer.addEventListener('click',onBackdrop);
    document.addEventListener('keydown',onKeydown,true);
    confirm.focus();
  });
}
