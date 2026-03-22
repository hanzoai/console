import DocPopup from "@/src/components/layouts/doc-popup";
import { Label } from "@hanzo/ui";

export function VariableMappingDescription(p: { title: string; description: string; href: string }) {
  return (
    <div className="flex w-1/2 items-center">
      <Label className="muted-foreground text-sm font-light">{p.title}</Label>
      <DocPopup description={p.description} href={p.href} />
    </div>
  );
}
