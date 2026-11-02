import { useT } from "../../../ui/useT";
import { PagePlaceholder } from "./PagePlaceholder";

export default function Stats() {
  const t = useT();

  return (
    <PagePlaceholder
      title={t("view.stats.title")}
      note={t("view.stats.note")}
    />
  );
}
