import { useT } from "../../../ui/useT";
import { PagePlaceholder } from "./PagePlaceholder";

export default function Todos() {
  const t = useT();

  return (
    <PagePlaceholder
      title={t("view.todos.title")}
      note={t("view.todos.note")}
    />
  );
}
