import { InputCommandItem } from "@/src/components/ui/input-command";
import { Button } from "@/src/components/ui/button";
import { useInsightsCapture } from "@/src/features/insights-analytics/useInsightsCapture";
import { Checkbox } from "@hanzo/ui";

type TagCommandItemProps = {
  value: string;
  selectedTags: string[];
  setSelectedTags: (value: string[]) => void;
};

const TagCommandItem = ({ value, selectedTags, setSelectedTags }: TagCommandItemProps) => {
  const capture = useInsightsCapture();
  return (
    <InputCommandItem
      key={value}
      value={value}
      onSelect={() => {
        setSelectedTags([...selectedTags, value]);
        capture("tag:add_existing_tag", {
          name: value,
        });
      }}
    >
      <Checkbox className="mr-1 h-4 w-4" />
      <Button variant="ghost" size="xs" className="font-normal">
        {value}
      </Button>
    </InputCommandItem>
  );
};

export default TagCommandItem;
