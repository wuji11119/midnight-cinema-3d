// 资产路径锚定:以本文件位置(/cinema3d/src/)向上两级 = 站点内容根
// 本地 serve(root=项目根)与 GitHub Pages 子路径(/repo/)两端同时正确
export const asset = p => new URL('../../' + p, import.meta.url).href;
