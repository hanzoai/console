import { Button } from "@/src/components/ui/button";
import { Github } from "lucide-react";

const PricingFooterLinks = () => {
  return (
    <div className="mt-8 text-center flex flex-wrap justify-center">
      <Button variant="outline" className="border-gray-800 hover:bg-gray-800 px-4 py-2 h-10 min-w-[152px]" size="sm">
        <a href="https://github.com/hanzoai" target="_blank" rel="noopener noreferrer" className="flex items-center">
          Hanzo GitHub
          <Github className="ml-2 h-4 w-4" />
        </a>
      </Button>
      <Button variant="outline" className="border-gray-800 hover:bg-gray-800 px-4 py-2 h-10 min-w-[152px]" size="sm">
        <a href="mailto:sales@hanzo.ai">
          Contact Sales
        </a>
      </Button>
      <Button variant="outline" className="border-gray-800 hover:bg-gray-800 px-4 py-2 h-10 min-w-[152px]" size="sm">
        <a href="https://discord.gg/XthHQQj" target="_blank" rel="noopener noreferrer">
          Join Discord
        </a>
      </Button>
    </div>
  );
};

export default PricingFooterLinks;
