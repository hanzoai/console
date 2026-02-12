import { cn } from "@/src/utils/tailwind";

type BarListItem = {
  name: string;
  value: number;
};

export function BarList(props: {
  data: BarListItem[];
  valueFormatter?: (value: number) => string;
  className?: string;
  color?: string;
}) {
  const maxValue = Math.max(...props.data.map((d) => d.value), 1);
  const formatter = props.valueFormatter ?? ((v: number) => String(v));
  const barColor = props.color ?? "#6366f1";

  return (
    <div className={cn("space-y-2", props.className)}>
      {props.data.map((item) => (
        <div key={item.name} className="group flex items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <div
              className="absolute inset-y-0 left-0 rounded-sm opacity-20 transition-opacity group-hover:opacity-30"
              style={{
                width: `${(item.value / maxValue) * 100}%`,
                backgroundColor: barColor,
              }}
            />
            <p className="relative truncate py-0.5 pl-2 text-sm text-muted-foreground">
              {item.name}
            </p>
          </div>
          <span className="flex-shrink-0 text-sm font-medium text-muted-foreground">
            {formatter(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
