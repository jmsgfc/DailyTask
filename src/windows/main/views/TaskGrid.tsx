import { useT } from "../../../ui/useT";
import { PagePlaceholder } from "./PagePlaceholder";

export default function TaskGrid() {
  const t = useT();

  return (
    <PagePlaceholder
      title={t("view.grid.title")}
      note={t("view.grid.note")}
    />
  );
}
