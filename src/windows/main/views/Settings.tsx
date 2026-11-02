import { useT } from "../../../ui/useT";
import { PagePlaceholder } from "./PagePlaceholder";

export default function Settings() {
  const t = useT();

  return (
    <PagePlaceholder
      title={t("view.settings.title")}
      note={t("view.settings.note")}
    />
  );
}
