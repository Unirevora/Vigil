import {icon} from '../icons.js';
import {BACKGROUND_PRESETS,COLOR_PRESETS} from '../../appearance/settings.js';
import {dataManagementPanels} from './data.js';
import {aboutPanel} from './about.js';

const bgClass={paper:'bg-paper',mountains:'bg-mountains',sage:'bg-sage',sea:'bg-sea',custom:'bg-custom',none:'bg-none'};
const selectOption=(value,current,name)=>`<option value="${value}" ${value===current?'selected':''}>${name}</option>`;
const rangeControl=(label,key,value,min,max,step=1,unit='')=>`<label class="settings-range-row" for="setting-${key}">
  <span class="settings-row-title">${label}<output id="${key}Value" for="setting-${key}">${value}${unit}</output></span>
  <input type="range" id="setting-${key}" min="${min}" max="${max}" step="${step}" value="${value}" data-setting="${key}"/>
</label>`;
const sectionHead=(title,subtitle)=>`<header class="settings-section-heading"><h2>${title}</h2><p>${subtitle}</p></header>`;

function appearancePanel(state){
  const a=state.appearance;
  return `<div class="settings-panel-stack">
    <section class="settings-group settings-group-first">
      ${sectionHead('颜色与明暗','主色会同步更新侧栏、按钮与悬浮玻璃，不再只作用于正文强调色。')}
      <div class="settings-tone-row">
        <span class="settings-row-title">纸面主题</span>
        <button type="button" class="settings-theme-switch" data-action="theme" aria-label="切换日间与夜间主题">
          ${icon(a.theme==='paper'?'sun':'moon')}<span>${a.theme==='paper'?'暖纸日间':'深墨夜间'}</span>${icon('arrow')}
        </button>
      </div>
      <div class="settings-tone-row settings-colors-row"><span class="settings-row-title">主题色</span>
        <div class="settings-color-options" role="group" aria-label="选择主题色">
          ${COLOR_PRESETS.map(p=>`<button type="button" class="color-swatch ${a.accent===p.color?'active':''}" data-action="setting-accent" data-color="${p.color}" aria-label="${p.name}主题色" title="${p.name}" aria-pressed="${a.accent===p.color}"><span class="color-dot" style="background:${p.color}">${a.accent===p.color?icon('check'):''}</span><span>${p.name}</span></button>`).join('')}
          <label class="color-swatch color-custom" title="自定义主题色"><span class="color-dot" id="accentPreview" style="background:${a.accent}"><input type="color" id="accentColor" aria-label="自定义主题色" value="${a.accent}"></span><span>自定义</span></label>
        </div>
      </div>
    </section>
    <section class="settings-group">
      ${sectionHead('背景','高清风物与纯色纸面；你的本地图片只保存在当前设备。')}
      <div class="settings-backgrounds" role="group" aria-label="背景选择">
        ${BACKGROUND_PRESETS.map(bg=>`<button type="button" class="background-option ${bgClass[bg.key]} ${a.background===bg.key?'active':''}" data-action="setting-background" data-background="${bg.key}" aria-pressed="${a.background===bg.key}"><span class="bg-preview"></span><span class="bg-preview-label">${bg.name}</span></button>`).join('')}
      </div>
      <div class="settings-file-actions"><label for="backgroundFile" class="settings-text-action">${icon('image')} 上传高清背景</label><input id="backgroundFile" type="file" accept="image/*" hidden>
        <button class="settings-text-action subtle" data-action="remove-custom-background" ${a.background==='custom'?'':'disabled'}>恢复默认</button></div>
      <div class="settings-inline-sliders">
        ${rangeControl('背景强度','backgroundOpacity',a.backgroundOpacity,0,85,1,'%')}
        ${rangeControl('纸面透光','surfaceOpacity',a.surfaceOpacity,50,100,1,'%')}
      </div>
    </section>
    <section class="settings-group">
      ${sectionHead('首页静物','保留复古打字机，也可以换成你自己的照片。')}
      <div class="settings-hero-row">
        <button type="button" class="hero-style-choice ${a.heroMode==='original'?'active':''}" data-action="setting-hero" data-hero="original" aria-pressed="${a.heroMode==='original'}"><img src="/assets/typewriter-still-life.webp" alt="默认静物"><span>经典文房</span></button>
        <button type="button" class="hero-style-choice ${a.heroMode==='custom'?'active':''}" data-action="setting-hero" data-hero="custom" aria-pressed="${a.heroMode==='custom'}"><span class="hero-custom-frame">${icon('image')}<small>自定义静物</small></span><span>我的照片</span></button>
        <div class="settings-file-actions"><label for="heroFile" class="settings-text-action">${icon('upload')} 上传图片</label><input id="heroFile" type="file" accept="image/*" hidden>
          <button class="settings-text-action subtle" data-action="remove-custom-hero" ${a.heroMode==='custom'?'':'disabled'}>恢复经典</button></div>
      </div>
    </section>
  </div>`;
}
function readingPanel(state){
  const a=state.appearance;
  return `<div class="settings-panel-stack">
    <section class="settings-group settings-group-first">
      ${sectionHead('正文排版','这些选项同时影响写作、阅读及文章卡片。')}
      <div class="settings-inline-field"><label for="fontFamilySelect">字体风格</label><select id="fontFamilySelect" data-setting="fontFamily" aria-label="字体风格">
        ${selectOption('heritage',a.fontFamily,'原版文房')}${selectOption('song',a.fontFamily,'宋体阅读')}${selectOption('sans',a.fontFamily,'现代无衬线')}${selectOption('kai',a.fontFamily,'楷体手札')}
      </select></div>
      <div class="settings-inline-sliders">
        ${rangeControl('正文大小','bodyFontSize',a.bodyFontSize,13,22,1,'px')}
        ${rangeControl('行间距','lineHeight',a.lineHeight,1.45,2.5,.05)}
        ${rangeControl('版心宽度','contentWidth',a.contentWidth,860,1740,20,'px')}
      </div>
    </section>
    <section class="settings-group">
      ${sectionHead('纸面质感','长文章保持稳定、柔和的实色阅读表面。')}
      <label class="settings-toggle-row"><span><strong>纸张纤维</strong><small>保留极淡的旧纸颗粒质感</small></span><input type="checkbox" data-setting="texture" ${a.texture?'checked':''} aria-label="纸张纤维"/><span class="settings-toggle-visual" aria-hidden="true"></span></label>
      <p class="settings-hint">若偏好纯净阅读，可以关掉纸纹并把纸面透光调到 100%。</p>
    </section>
  </div>`;
}
function interactionPanel(state){
  const a=state.appearance;
  return `<div class="settings-panel-stack">
    <section class="settings-group settings-group-first">
      ${sectionHead('侧栏玻璃','真正的半透明材质，让背景透过侧栏，同时保持文字可读。')}
      <div class="settings-inline-field"><label for="sidebarToneSelect">侧栏配色</label><select id="sidebarToneSelect" data-setting="sidebarTone" aria-label="侧栏配色">
        ${selectOption('accent',a.sidebarTone,'跟随主题色')}${selectOption('ink',a.sidebarTone,'经典墨绿')}
      </select></div>
      <div class="settings-inline-sliders">
        ${rangeControl('侧栏着色浓度','sidebarGlass',a.sidebarGlass,55,96,1,'%')}
        ${rangeControl('侧栏模糊程度','sidebarBlur',a.sidebarBlur,0,36,2,'px')}
        ${rangeControl('悬浮控件浓度','glassTint',a.glassTint,28,92,1,'%')}
      </div>
      <div class="settings-material-preview" aria-label="液态玻璃效果预览"><span class="settings-preview-line"></span><span class="settings-preview-control">${icon('search')} 轻透搜索</span><span class="settings-preview-control">${icon('settings')} 浮层</span></div>
    </section>
    <section class="settings-group">
      ${sectionHead('动效','在操作反馈与静谧书写之间选择合适的节奏。')}
      <div class="settings-inline-field"><label for="motionModeSelect">动效强度</label><select id="motionModeSelect" data-setting="motionMode" aria-label="动效强度">
        ${selectOption('standard',a.motionMode,'轻盈回弹')}${selectOption('subtle',a.motionMode,'更克制')}${selectOption('off',a.motionMode,'关闭动效')}
      </select></div>
      <p class="settings-hint">系统开启「减少动态效果」时，始终优先遵守系统设置。</p>
    </section>
  </div>`;
}
export function settingsView(state){
  const active=['appearance','reading','interaction','data','about'].includes(state.settingsTab)?state.settingsTab:'appearance';
  const tabs=[['appearance','外观'],['reading','排版'],['interaction','交互'],['data','数据'],['about','关于']];
  const content={appearance:appearancePanel,reading:readingPanel,interaction:interactionPanel,about:aboutPanel};
  return `<section class="appearance-page settings-hub-page settings-153">
    <header class="page-head settings-hub-head"><div><div class="page-eyebrow">PREFERENCES / VIGIL</div><h1>设置</h1><p>让写作空间清晰、舒适且可靠。</p></div>
      ${active==='about'||active==='data'?'':`<button class="settings-reset" data-action="reset-appearance">${icon('refresh')} 恢复经典外观</button>`}</header>
    <nav class="settings-hub-tabs" role="tablist" aria-label="设置分类">${tabs.map(([key,label])=>`<button type="button" id="settings-tab-${key}" class="settings-tab ${active===key?'active':''}" role="tab" aria-controls="settings-content" aria-selected="${active===key}" tabindex="${active===key?'0':'-1'}" data-action="settings-tab" data-tab="${key}">${label}</button>`).join('')}</nav>
    <section class="settings-hub-panel" id="settings-content" role="tabpanel" aria-labelledby="settings-tab-${active}">
      ${active==='data'?dataManagementPanels(state,{embedded:true}):content[active](state)}
    </section>
    <footer class="settings-bottom-note">${icon('check')} 设置会即时保存到当前设备，不会修改任何手记。</footer>
  </section>`;
}
