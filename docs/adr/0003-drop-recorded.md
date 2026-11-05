# ADR 0003：移除 recorded 状态

> 状态：已接受
> 日期：2026-11-05
> 相关：product/decisions.md、architecture/data.md、architecture/domain.md

## 背景

「只记录」让只填值不判定的格子显示成 `•`，容易被误认为第四种打卡状态，也增加统计分支。

## 决策

- `CheckinStatus` 只保留 `done / missed / skipped`
- `value` 保留为附加字段
- 没有判定时写值自动记为 `done`
- 迁移 004 把旧 `recorded` 转为 `done`
- 旧 JSON 导入同样归一

## 理由

- 用户心智只有三种判定
- 统计分母简化为 `applicable − skipped`
- 值仍然保留，不丢数据

## 代价

- 无法再表达「有值但未判定」
- 旧 recorded 会计入完成率 / streak
- 需要重建 checkins 表（SQLite CHECK 限制）

## 被否方案

- 保留 recorded 但换视觉：仍多一个状态
- 值单独建表：查询与导入导出复杂，收益低
