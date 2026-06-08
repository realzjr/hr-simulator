/**
 * 游戏入口 - 初始化
 */

/** 已预加载完成的头像路径集合 */
const _preloadedAvatars = new Set();

document.addEventListener('DOMContentLoaded', () => {
  // 预加载所有头像SVG，加载完成后记录到缓存集合
  [...AVATAR_LIST, HR_AVATAR_MALE, HR_AVATAR_FEMALE].forEach(src => {
    const img = new Image();
    img.onload = () => _preloadedAvatars.add(src);
    img.src = src;
  });

  renderIntro();
  switchScene('intro');
});
