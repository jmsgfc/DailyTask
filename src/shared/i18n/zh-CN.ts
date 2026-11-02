/**
 * 中文文案是 key 的唯一定义处；新增语言时实现同一份 Messages。
 * 句子里不要拼变量，统一用 {name} 占位符，方便以后换语序。
 */
export const zhCN = {
  "nav.today": "今日",
  "nav.grid": "任务表",
  "nav.todos": "待办",
  "nav.manage": "任务管理",
  "nav.stats": "统计",
  "nav.settings": "设置",
  "app.footer": "v{version} · 本地数据",
  "app.loading": "正在加载…",
  "app.initFailed": "初始化失败，请重启应用。",
  "app.initFailedHint": "详情见开发者工具控制台。",

  "today.title": "今日",
  "today.doneOfTotal": "已完成 {done} / {total} 项",
  "today.rate": "完成率 {percent}% · {status}",
  "today.noTasks": "今天没有任务",
  "today.remaining": "还剩 {count} 项",
  "today.allDone": "今天已收尾",
  "today.category.voluntary": "自愿",
  "today.category.forced": "被迫",
  "today.group.voluntary": "自愿任务",
  "today.group.forced": "被迫任务",
  "today.empty": "今天没有需要打卡的任务",
  "today.dueTodos": "今日到期待办",
  "today.overdueDays": "逾期 {days} 天",
  "today.dueToday": "今天",
  "today.skip": "今天不做",
  "today.unskip": "取消",

  "checkin.done": "已完成",
  "checkin.missed": "未完成",
  "checkin.skipped": "今天不做",
  "checkin.pending": "未打卡",
  "checkin.none": "不适用",
  "checkin.aria": "{task}：{status}",

  "progress.aria": "今日进度 {done} / {total}",
  "common.itemCount": "{count} 项",

  "view.grid.title": "任务表",
  "view.grid.note": "M4 实现 · 日期列 + 任务行网格",
  "view.todos.title": "待办",
  "view.todos.note": "M5 实现 · 四分组与行内完成",
  "view.manage.title": "任务管理",
  "view.manage.note": "M5 实现 · 启用区间与任务表格",
  "view.stats.title": "统计",
  "view.stats.note": "M6 实现 · streak 与近 30 天完成率",
  "view.settings.title": "设置",
  "view.settings.note": "M6 实现 · 主题 / 自启 / 导入导出",
} as const;

export type MessageKey = keyof typeof zhCN;
export type Messages = Record<MessageKey, string>;
