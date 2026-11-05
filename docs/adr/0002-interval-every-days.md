# ADR 0002：区间模型 + 每 N 天

> 状态：已接受
> 日期：2026-11-05
> 相关：architecture/data.md、architecture/domain.md、product/decisions.md

## 背景

任务会停用、重新启用，也需要「每 3 天一次」这类周期。历史打卡不能因为编辑区间而改变。

## 决策

- 启用区间拆到 `task_intervals`，一个任务可有多段
- 每段独立 `start_date` / `end_date` / `every_days`
- 停用 = 关闭开放区间；重新启用 = 追加新段
- `every_days` 以该段 `start_date` 为第 1 天，每 N 天命中一次

## 理由

- 历史段与打卡不被后续编辑污染
- 每段独立锚点，停用后再启用可重新起算
- 查询仍可走 `(task_id, start_date)` 索引

## 代价

- UI 只展示最新一段，历史段只读
- 统计需要按段判断周期
- 旧 JSON 需要 `everyDays` 缺省兼容

## 被否方案

- 任务级 `every_days`：重新启用会改历史周期
- 生成具体打卡日期行：数据量大，编辑区间要批量回写
