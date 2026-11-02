import { useT } from "../../../ui/useT";
import { PagePlaceholder } from "./PagePlaceholder";

export default function Manage() {
  const t = useT();

  return (
    <PagePlaceholder
      title={t("view.manage.title")}
      note={t("view.manage.note")}
    />
  );
}
