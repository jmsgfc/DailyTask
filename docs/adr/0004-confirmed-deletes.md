# ADR 0004：删除确认令牌

> 状态：已接受
> 日期：2026-11-05
> 相关：development/conventions.md、architecture/overview.md

## 背景

删除入口越来越多（待办行、右键菜单、任务管理）。只靠组件封装无法阻止后续页面直接调用 store 删除。

## 决策

- `ConfirmDeleteButton` 是唯一删除 UI 入口
- `ConfirmDialog` 不导出
- store 的 `remove` 要求 `DeleteConfirmation` 品牌类型
- 令牌只在用户点击确认后由组件构造并传给 `onConfirm`
- `src/windows/**` 禁止 import 删除令牌

## 理由

- 直接 `remove(id)` 编译失败，不依赖自觉
- 所有入口共享确认、pending、错误处理
- 后续新增删除只需复用组件

## 代价

- store 签名多一个参数
- 测试需要传令牌
- 强转类型仍可绕过（只防正常开发误用）

## 被否方案

- 只写文档约定：容易绕过
- 每个页面各写确认弹窗：重复且文案漂移
- 运行时全局确认：异步流程难追踪
