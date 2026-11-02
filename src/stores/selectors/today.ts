import { format, parseISO } from "date-fns";
import { useMemo } from "react";

import { dateLocale } from "../../shared/i18n";

import { applicableTasks } from "../../domain/applicability";
import { diffDays, logicalToday } from "../../domain/date";
import { checkinKey } from "../../domain/keys";
import {
  dayProgress,
  projectCell,
  type CellState,
  type DayProgress,
} from "../../domain/settle";
import type { Checkin, Settings, Task, Todo } from "../../domain/types";
import { useCheckinsStore } from "../checkinsStore";
import { useSettingsStore } from "../settingsStore";
import { useTasksStore } from "../tasksStore";
import { useTodosStore } from "../todosStore";

export interface TodayTask {
  task: Task;
  state: CellState;
}

export interface CategoryStat {
  done: number;
  total: number;
}

export interface DueTodoItem {
  todo: Todo;
  overdueDays: number;
}

export interface TodayData {
  today: string;
  dateLabel: string;
  voluntary: TodayTask[];
  forced: TodayTask[];
  progress: DayProgress;
  voluntaryStat: CategoryStat;
  forcedStat: CategoryStat;
  overdueTodos: DueTodoItem[];
  todayTodos: DueTodoItem[];
  dueTodos: DueTodoItem[];
}

function statOf(rows: TodayTask[]): CategoryStat {
  const countable = rows.filter((row) => row.state !== "skipped");
  return {
    done: countable.filter((row) => row.state === "done").length,
    total: countable.length,
  };
}

export function buildToday(
  tasks: Task[],
  checkins: Map<string, Checkin>,
  settings: Settings,
  todos: Todo[],
  now: Date,
): TodayData {
  const today = logicalToday(now, settings.dayStartHour);
  const rows: TodayTask[] = applicableTasks(tasks, today)
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
    .map((task) => ({
      task,
      state: projectCell(
        task,
        today,
        checkins.get(checkinKey(task.id, today)),
        settings,
        today,
      ),
    }));

  const voluntary = rows.filter((row) => row.task.category === "voluntary");
  const forced = rows.filter((row) => row.task.category === "forced");

  const dueTodos: DueTodoItem[] = todos
    .filter((todo) => !todo.done && todo.dueDate !== null && todo.dueDate <= today)
    .map((todo) => ({
      todo,
      overdueDays: diffDays(today, todo.dueDate as string),
    }))
    .sort((a, b) => (a.todo.dueDate as string).localeCompare(b.todo.dueDate as string));

  return {
    today,
    dateLabel: format(parseISO(today), "MM/dd EEEE", {
      locale: dateLocale(settings.language),
    }),
    voluntary,
    forced,
    progress: dayProgress(tasks, checkins, today, settings, today),
    voluntaryStat: statOf(voluntary),
    forcedStat: statOf(forced),
    overdueTodos: dueTodos.filter((item) => item.overdueDays > 0),
    todayTodos: dueTodos.filter((item) => item.overdueDays === 0),
    dueTodos,
  };
}

export function useTodayData(): TodayData {
  const tasks = useTasksStore((state) => state.tasks);
  const checkins = useCheckinsStore((state) => state.byKey);
  const settings = useSettingsStore((state) => state.settings);
  const todos = useTodosStore((state) => state.todos);

  return useMemo(
    () => buildToday(tasks, checkins, settings, todos, new Date()),
    [tasks, checkins, settings, todos],
  );
}
