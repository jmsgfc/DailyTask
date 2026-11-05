/**
 * 删除确认令牌。
 *
 * store 的 remove 方法要求这个品牌类型；正常路径下只有
 * `ui/ConfirmDeleteButton` 在用户点击「确认删除」后才会构造令牌。
 * 页面直接调用 `remove(id)` 会编译失败，避免绕过二次确认。
 */
declare const deleteConfirmed: unique symbol;

export interface DeleteConfirmation {
  readonly [deleteConfirmed]: true;
}
