import {motionAllowed} from './motion.js';

let closeTimer=null;

/**
 * Ephemeral passphrase prompt for *new* v1 encrypted JSON format.
 * Never writes secrets to localStorage or global app state.
 */
export function requestPassphrase({mode='export'}={}){
  const layer=document.querySelector('#passphraseLayer');
  const form=document.querySelector('#passphraseForm');
  const first=document.querySelector('#passphraseInput');
  const again=document.querySelector('#passphraseRepeat');
  const confirmRow=document.querySelector('#passphraseConfirmRow');
  const hint=document.querySelector('#passphraseHint');
  const title=document.querySelector('#passphraseTitle');
  const desc=document.querySelector('#passphraseDesc');
  const okay=document.querySelector('#passphraseOk');
  const cancel=document.querySelector('#passphraseCancel');
  if(!layer || !form) return Promise.resolve(null);
  if(!layer.hidden && !layer.classList.contains('is-closing')) return Promise.resolve(null);
  clearTimeout(closeTimer);
  layer.classList.remove('is-closing');
  const creating=mode==='export';
  title.textContent=creating?'为备份设置口令':'解锁加密备份';
  desc.textContent=creating
    ?'将正式手记加密为独立的 .vigil.json 文件。请牢记口令。'
    :'输入创建文件时设置的口令，解密后仍会先确认是否导入。';
  okay.textContent=creating?'加密并下载':'解锁文件';
  confirmRow.hidden=!creating;
  first.value='';again.value='';
  first.setAttribute('minlength',creating?'10':'1');
  hint.textContent=creating
    ?'至少 10 个字符。口令丢失后无法恢复文件，请自行妥善保管。'
    :'口令仅用于此次解密，不会保存。';
  hint.classList.remove('error');
  const previous=document.activeElement;
  layer.hidden=false;layer.setAttribute('aria-hidden','false');
  first.focus();

  return new Promise(resolve=>{
    const cleanup=answer=>{
      layer.hidden=true;
      layer.setAttribute('aria-hidden','true');
      if(motionAllowed()){
        layer.classList.add('is-closing');
        closeTimer=setTimeout(()=>layer.classList.remove('is-closing'),155);
      }
      form.removeEventListener('submit',onSubmit);
      cancel.removeEventListener('click',onCancel);
      layer.removeEventListener('click',onBackdrop);
      document.removeEventListener('keydown',onKey,true);
      // Wipe both DOM inputs immediately. The returned string is held only in caller
      // scope until the crypto operation ends.
      first.value='';again.value='';
      if(previous?.isConnected)previous.focus();
      resolve(answer);
    };
    const onSubmit=event=>{
      event.preventDefault();
      const value=first.value;
      if(creating && [...value].length<10){
        hint.textContent='口令至少需要 10 个字符。';hint.classList.add('error');first.focus();return;
      }
      if(creating && value!==again.value){
        hint.textContent='两次输入的口令不一致。';hint.classList.add('error');again.focus();return;
      }
      if(!value){first.focus();return;}
      cleanup(value);
    };
    const onCancel=()=>cleanup(null);
    const onBackdrop=event=>{if(event.target===layer)cleanup(null);};
    const onKey=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cleanup(null);}
      if(event.key!=='Tab')return;
      const choices=[first,...(creating?[again]:[]),cancel,okay].filter(n=>!n.hidden);
      const current=choices.indexOf(document.activeElement);
      if(event.shiftKey&&(current<=0)){event.preventDefault();okay.focus();}
      else if(!event.shiftKey&&current===choices.length-1){event.preventDefault();first.focus();}
    };
    form.addEventListener('submit',onSubmit);
    cancel.addEventListener('click',onCancel);
    layer.addEventListener('click',onBackdrop);
    document.addEventListener('keydown',onKey,true);
  });
}
