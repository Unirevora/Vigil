import {icon} from '../icons.js';
import {COLOR_PRESETS,BACKGROUND_PRESETS} from '../../appearance/settings.js';
import {escapeHtml} from '../../core/format.js';
const select=(options,current)=>options.map(([value,label])=>`<option value="${value}" ${current===value?'selected':''}>${label}</option>`).join('');
export function settingsView(state){
  const a=state.appearance;
  return `<section class="appearance-page">
    <header class="page-head appearance-heading"><div>
      <div class="page-eyebrow">外观工坊 · ATELIER</div><h1>布置你的文房</h1>
      <p>择一纸色，添一缕风景。所有设置仅保存于当前浏览器。</p>
    </div><div class="head-actions"><button class="btn btn-quiet" data-action="reset-appearance">${icon('refresh')} 恢复经典外观</button></div></header>
    <div class="appearance-intro"><span class="intro-seal">雅</span><div>
      <strong>所见，即所好</strong><small>色彩、背景、纸张和字距均可单独调整。不会改动任何手记内容。</small>
    </div><span class="appearance-intro-caption">VIGIL / CUSTOMIZE</span></div>
    <div class="appearance-section"><div class="appearance-section-heading"><h2>主题色</h2><p>为重要操作选择一种强调色。</p></div>
      <div class="appearance-color-grid">${COLOR_PRESETS.map(item=>`<button type="button" class="color-swatch ${item.color===a.accent?'active':''}"
        data-action="setting-accent" data-color="${item.color}" aria-pressed="${item.color===a.accent}">
        <span class="color-dot" style="background:${item.color}">${item.color===a.accent?icon('check'):''}</span><span>${item.name}</span>
      </button>`).join('')}
      <label class="color-swatch color-custom"><input type="color" id="accentColor" value="${escapeHtml(a.accent)}" aria-label="自定义主题色">
      <span>自定义</span></label></div>
      <div class="setting-inline"><label for="themeMode">纸面昼夜</label><select id="themeMode" data-setting="theme">
      ${select([['paper','暖纸 · 日光'],['night','墨夜 · 夜色']],a.theme)}</select>
      <span class="setting-value">跟随自己的书写心境</span></div>
    </div>
    <div class="appearance-section"><div class="appearance-section-heading"><h2>背景</h2><p>简洁背景，或者使用自己的图片。</p></div>
      <div class="background-grid">${BACKGROUND_PRESETS.map(item=>`<button type="button" data-action="setting-background" data-background="${item.key}"
        class="background-option bg-${item.key} ${a.background===item.key?'active':''}" aria-pressed="${a.background===item.key}">
        <span class="bg-preview"><span class="bg-preview-label">${item.key==='custom'?'自选':''}</span></span>
        <strong>${item.name}</strong><small>${item.description}</small>
      </button>`).join('')}</div>
      <div class="setting-controls"><label class="setting-range">背景明暗 <span id="backgroundOpacityValue">${a.backgroundOpacity}%</span>
         <input type="range" id="backgroundOpacity" data-setting="backgroundOpacity" min="0" max="85" value="${a.backgroundOpacity}"></label>
        <label class="setting-range">纸面遮罩 <span id="surfaceOpacityValue">${a.surfaceOpacity}%</span>
         <input type="range" id="surfaceOpacity" data-setting="surfaceOpacity" min="50" max="100" value="${a.surfaceOpacity}"></label></div>
      <div class="appearance-upload-row"><label class="btn" for="backgroundFile">${icon('upload')} 上传背景图</label>
         <input id="backgroundFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
         <button type="button" class="text-button" data-action="remove-background">清除自定义背景</button>
         <span class="quiet">本机存储 · 自动压缩 · 不上传服务器</span></div>
    </div>
    <div class="appearance-layout-lower">
      <section class="appearance-section"><div class="appearance-section-heading"><h2>排版</h2><p>阅读舒适度优先。</p></div>
        <div class="font-family-setting"><label for="fontFamily">书写字体</label>
        <select id="fontFamily" data-setting="fontFamily">
        ${select([['heritage','原版字体 · 铅字旧梦'],['song','宋体 · 书卷气'],['sans','黑体 · 清朗'],['kai','楷体 · 手札']],a.fontFamily)}</select></div>
      <div class="setting-controls vertical"><label class="setting-range">正文字号 <span id="bodyFontSizeValue">${a.bodyFontSize}px</span>
         <input type="range" id="bodyFontSize" data-setting="bodyFontSize" min="13" max="22" step="1" value="${a.bodyFontSize}"></label>
         <label class="setting-range">正文行距 <span id="lineHeightValue">${a.lineHeight}</span>
         <input type="range" id="lineHeight" data-setting="lineHeight" min="1.45" max="2.5" step="0.05" value="${a.lineHeight}"></label>
         <label class="setting-range">画布宽度 <span id="contentWidthValue">${a.contentWidth}px</span>
         <input type="range" id="contentWidth" data-setting="contentWidth" min="860" max="1740" step="20" value="${a.contentWidth}"></label>
         <label class="setting-switch"><span>宣纸纤维纹理</span><input id="paperTexture" data-setting="texture" type="checkbox" ${a.texture?'checked':''}></label>
        </div>
      </section>
      <section class="appearance-section"><div class="appearance-section-heading"><h2>首页插画</h2><p>保留打字机，也可上传自己的照片。</p></div>
        <div class="hero-style-options">
          <button class="hero-style-choice ${a.heroMode==='original'?'active':''}" data-action="setting-hero" data-hero="original" aria-pressed="${a.heroMode==='original'}">
            <img src="/assets/typewriter-still-life.webp" alt="原版复古打字机装饰"><span>铅字旧梦</span></button>
          <button class="hero-style-choice ${a.heroMode==='custom'?'active':''}" data-action="setting-hero" data-hero="custom" aria-pressed="${a.heroMode==='custom'}">
            <span class="hero-custom-frame">${icon('image')}<small>自选照片</small></span><span>我的案头</span></button>
        </div>
        <div class="appearance-upload-row"><label class="btn" for="heroFile">${icon('upload')} 上传静物图</label>
          <input id="heroFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
          <button class="text-button" data-action="remove-hero">还原原版</button></div>
      </section>
    </div>
    <div class="appearance-footer"><span>${icon('shield')} 这些偏好与正式手记分别保存，不会影响备份文件。</span>
      <button class="btn btn-primary" data-action="nav" data-to="home">返回卷首 ${icon('arrow')}</button></div>
  </section>`;
}
