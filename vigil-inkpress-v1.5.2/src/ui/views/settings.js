import {icon} from '../icons.js';
import {BACKGROUND_PRESETS,COLOR_PRESETS} from '../../appearance/settings.js';
import {dataManagementPanels} from './data.js';

const bgClass={paper:'bg-paper',mountains:'bg-mountains',sage:'bg-sage',sea:'bg-sea',custom:'bg-custom',none:'bg-none'};

function appearancePanel(state){
  const a=state.appearance;
  return `
    <div class="settings-panel-head"><div><h2>外观工坊</h2><p>纸张、颜色与排版，随心调整。</p></div></div>
    <section class="appearance-section">
      <div class="appearance-section-heading"><h2>主题色与字体</h2><p>统一调整全局主色、正文大小与字面风格。</p></div>
      <div class="appearance-color-grid">${COLOR_PRESETS.map(p=>`<button class="color-swatch ${a.accent===p.color?'active':''}" data-action="setting-accent" data-color="${p.color}" aria-pressed="${a.accent===p.color}"><span class="color-dot" style="background:${p.color}">${a.accent===p.color?icon('check'):''}</span><span>${p.name}</span></button>`).join('')}
        <label class="color-swatch color-custom"><span class="color-dot"><input type="color" id="accentColor" aria-label="自定义主题色" value="${a.accent}"></span><span>自定义</span></label>
      </div>
      <div class="setting-inline font-family-setting"><label for="fontFamilySelect">字体风格</label><select id="fontFamilySelect" data-setting="fontFamily"><option value="heritage" ${a.fontFamily==='heritage'?'selected':''}>原版文房</option><option value="song" ${a.fontFamily==='song'?'selected':''}>宋体阅读</option><option value="sans" ${a.fontFamily==='sans'?'selected':''}>现代无衬线</option><option value="kai" ${a.fontFamily==='kai'?'selected':''}>楷体手札</option></select><span class="setting-value">全局生效</span></div>
      <div class="setting-controls">
        <label class="setting-range">正文大小 <span id="bodyFontSizeValue">${a.bodyFontSize}px</span><input type="range" min="13" max="22" step="1" data-setting="bodyFontSize" value="${a.bodyFontSize}"></label>
        <label class="setting-range">正文行距 <span id="lineHeightValue">${a.lineHeight}</span><input type="range" min="1.45" max="2.5" step="0.05" data-setting="lineHeight" value="${a.lineHeight}"></label>
      </div>
    </section>
    <section class="appearance-section">
      <div class="appearance-section-heading"><h2>背景与纸面</h2><p>淡彩山水、月夜与自选风景。</p></div>
      <div class="background-grid">${BACKGROUND_PRESETS.map(bg=>`<button class="background-option ${bgClass[bg.key]} ${a.background===bg.key?'active':''}" data-action="setting-background" data-background="${bg.key}" aria-pressed="${a.background===bg.key}"><span class="bg-preview"></span><span class="bg-preview-label">${bg.name}</span><strong>${bg.description}</strong><small>${bg.key==='custom'?'上传后覆盖当前背景':'内置背景'}</small></button>`).join('')}</div>
      <div class="appearance-upload-row"><label class="btn" for="backgroundFile">${icon('image')} 上传背景</label><input id="backgroundFile" type="file" accept="image/*" hidden>
        <button class="text-button" data-action="remove-custom-background" ${a.background==='custom'?'':'disabled'}>恢复内置背景</button>
        <span class="quiet">建议使用宽幅高清图片，系统会自动裁切与压缩。</span></div>
      <div class="setting-controls">
        <label class="setting-range">背景透明度 <span id="backgroundOpacityValue">${a.backgroundOpacity}%</span><input type="range" min="0" max="85" step="1" data-setting="backgroundOpacity" value="${a.backgroundOpacity}"></label>
        <label class="setting-range">纸面透明度 <span id="surfaceOpacityValue">${a.surfaceOpacity}%</span><input type="range" min="50" max="100" step="1" data-setting="surfaceOpacity" value="${a.surfaceOpacity}"></label>
      </div>
      <div class="setting-inline"><label>纸张纹理</label><label class="setting-switch"><span>开启纤维质感</span><input type="checkbox" data-setting="texture" ${a.texture?'checked':''}></label></div>
    </section>
    <div class="appearance-layout-lower">
      <section class="appearance-section">
        <div class="appearance-section-heading"><h2>首页静物图</h2><p>为卷首留一张安静的图像。</p></div>
        <div class="hero-style-options">
          <button class="hero-style-choice ${a.heroMode==='original'?'active':''}" data-action="setting-hero" data-hero="original" aria-pressed="${a.heroMode==='original'}"><img src="/assets/typewriter-still-life.webp" alt="默认静物图预览"><span>默认静物</span></button>
          <button class="hero-style-choice ${a.heroMode==='custom'?'active':''}" data-action="setting-hero" data-hero="custom" aria-pressed="${a.heroMode==='custom'}"><span class="hero-custom-frame">${icon('image')}<small>上传自定义图</small></span><span>我的图片</span></button>
        </div>
        <div class="appearance-upload-row"><label class="btn" for="heroFile">${icon('upload')} 上传首页图</label><input id="heroFile" type="file" accept="image/*" hidden>
          <button class="text-button" data-action="remove-custom-hero" ${a.heroMode==='custom'?'':'disabled'}>恢复默认</button></div>
      </section>
      <section class="appearance-section">
        <div class="appearance-section-heading"><h2>版心与主题</h2><p>压缩视觉噪音，优化大屏阅读和书写体验。</p></div>
        <div class="setting-controls vertical">
          <label class="setting-range">内容最大宽度 <span id="contentWidthValue">${a.contentWidth}px</span><input type="range" min="860" max="1740" step="20" data-setting="contentWidth" value="${a.contentWidth}"></label>
          <div class="setting-inline"><label>界面主题</label><div class="page-actions"><button class="btn ${a.theme==='paper'?'btn-primary':''}" data-action="theme">${a.theme==='paper'?'切换夜色':'切换纸面'}</button></div></div>
        </div>
      </section>
    </div>
    <div class="appearance-footer"><span>${icon('spark')} 设置会即时保存到当前设备。</span><span>VIGIL 1.5.2 · 轻雅版界面</span></div>`;
}

export function settingsView(state){
  const active=state.settingsTab||'appearance';
  const tabs=[
    {key:'appearance',label:'外观',hint:'背景、主题与排版'},
    {key:'data',label:'数据',hint:'导入、导出、备份与草稿'}
  ];
  return `<section class="appearance-page settings-hub-page">
    <header class="page-head appearance-heading settings-hub-head">
      <div><div class="page-eyebrow">SETTINGS · WORKBENCH</div><h1>设置</h1><p>外观与数据，悉数安放于此。</p></div>
    </header>
    <div class="settings-hub-tabs" role="tablist" aria-label="设置选项卡">${tabs.map(tab=>`<button type="button" class="settings-tab ${active===tab.key?'active':''}" role="tab" aria-selected="${active===tab.key}" data-action="settings-tab" data-tab="${tab.key}"><span>${tab.label}</span><small>${tab.hint}</small></button>`).join('')}</div>
    <section class="settings-hub-panel appearance-section settings-hub-surface">${active==='appearance'?appearancePanel(state):dataManagementPanels(state,{embedded:true})}</section>
  </section>`;
}
