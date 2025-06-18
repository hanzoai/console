import { Button } from "@/src/components/ui/button";

const APIPricing = () => {
  const hanzoModels = [
    {
      name: "Zen",
      fullName: "Zen - Flagship 1T+ Parameter MoDE LLM",
      description:
        "Our flagship model with 1T+ parameters using Mixture of Diverse Experts (MoDE) architecture. Optimal for complex reasoning, code generation, and multi-domain tasks.",
      features: [
        "200k context window",
        "MoDE architecture",
        "50% discount with batch processing*",
      ],
      pricing: {
        input: "$3 / MTok",
        promptCachingWrite: "$3.75 / MTok",
        promptCachingRead: "$0.30 / MTok",
        output: "$15 / MTok",
      },
    },
    {
      name: "Sho",
      fullName: "Sho - Next-Gen Diffusion LLM",
      description:
        "Revolutionary diffusion model that delivers faster, cheaper inference with breakthrough efficiency. Perfect for high-throughput applications.",
      features: [
        "200k context window",
        "Diffusion architecture",
        "Ultra-fast inference",
        "50% discount with batch processing*",
      ],
      pricing: {
        input: "$0.80 / MTok",
        promptCachingWrite: "$1 / MTok",
        promptCachingRead: "$0.08 / MTok",
        output: "$4 / MTok",
      },
    },
  ];

  const tools = [
    {
      name: "Web search",
      description: "Give Zen access to the latest information from the web",
      cost: "$10 / 1K searches*",
    },
    {
      name: "Code execution",
      description:
        "Run Python code in a sandboxed environment for advanced data analysis",
      details: "50 free hours of usage daily per organization",
      cost: "$0.05 per hour per container for additional usage",
    },
  ];

  const thirdPartyModels = [
    {
      name: "Claude Opus 3",
      features: ["200k context window", "50% discount with batch processing*"],
      pricing: {
        input: "$15 / MTok",
        promptCachingWrite: "$18.75 / MTok",
        promptCachingRead: "$1.50 / MTok",
        output: "$75 / MTok",
      },
    },
    {
      name: "Claude Sonnet 3.7",
      features: ["200k context window", "50% discount with batch processing*"],
      pricing: {
        input: "$3 / MTok",
        promptCachingWrite: "$3.75 / MTok",
        promptCachingRead: "$0.30 / MTok",
        output: "$15 / MTok",
      },
    },
  ];

  const ModelCard = ({
    model,
    isThirdParty = false,
  }: {
    model: any;
    isThirdParty: boolean;
  }) => (
    <div className="mb-6 rounded-xl border border-gray-800/50 bg-gray-900/30 p-6">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="mb-2 text-2xl font-semibold">
            {model.fullName || model.name}
          </h3>
          {model.description && (
            <p className="mb-4 text-lg text-neutral-400">{model.description}</p>
          )}

          {model.features && (
            <div className="mb-6">
              {model.features.map((feature: any, index: any) => (
                <div
                  key={index}
                  className="mb-2 flex items-center text-sm text-neutral-400"
                >
                  <span className="mr-3 h-2 w-2 rounded-full bg-neutral-400"></span>
                  {feature}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ml-6">
          <Button
            className="border border-gray-300 bg-[var(--white)] text-black transition-all duration-300 hover:border-[var(--white)] hover:bg-transparent hover:text-[var(--white)]"
            onClick={() => {
              // Link to cloud signup or checkout
              window.open("https://cloud.hanzo.ai/signup", "_blank");
            }}
          >
            Start Using {model.name}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg bg-black/20 p-4 text-sm md:grid-cols-4">
        <div>
          <span className="mb-1 block text-neutral-500">Input</span>
          <div className="text-lg font-medium">{model.pricing.input}</div>
        </div>
        <div>
          <span className="mb-1 block text-neutral-500">Output</span>
          <div className="text-lg font-medium">{model.pricing.output}</div>
        </div>
        <div>
          <span className="mb-1 block text-neutral-500">Cache Write</span>
          <div className="text-lg font-medium">
            {model.pricing.promptCachingWrite}
          </div>
        </div>
        <div>
          <span className="mb-1 block text-neutral-500">Cache Read</span>
          <div className="text-lg font-medium">
            {model.pricing.promptCachingRead}
          </div>
        </div>
      </div>
    </div>
  );

  const ToolCard = ({ tool }: { tool: any }) => (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900/30 p-6">
      <h3 className="mb-2 text-xl font-semibold">{tool.name}</h3>
      <p className="mb-4 text-neutral-400">{tool.description}</p>

      {tool.details && (
        <div className="mb-3 flex items-center text-sm text-neutral-400">
          <span className="mr-2 h-2 w-2 rounded-full bg-neutral-400"></span>
          {tool.details}
        </div>
      )}

      <div className="text-right">
        <span className="text-neutral-500">Cost</span>
        <div className="font-medium">{tool.cost}</div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto mb-16 max-w-7xl">
      {/* Hanzo Models Section */}
      <div className="mb-16">
        <h2 className="mb-4 text-3xl font-bold">Hanzo Foundational Models</h2>
        <p className="mb-8 text-lg text-neutral-400">
          Our flagship AI models built from the ground up for next-generation
          applications
        </p>
        <div className="mb-8 space-y-6">
          {hanzoModels.map((model) => (
            <ModelCard key={model.name} model={model} isThirdParty={false} />
          ))}
        </div>

        <div className="mb-6 text-sm text-neutral-500">
          *Learn more about{" "}
          <a href="#" className="text-blue-400 hover:underline">
            batch processing
          </a>
        </div>

        <div className="mb-6 text-sm text-neutral-500">
          Customers can purchase prioritized API capacity with Priority Tier
        </div>

        <div className="mb-8 text-sm text-neutral-500">
          Prompt caching pricing is for our standard 5-minute TTL;{" "}
          <a href="#" className="text-blue-400 hover:underline">
            extended prompt caching
          </a>{" "}
          is available at an additional cost
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            className="bg-white px-8 py-3 text-black hover:bg-gray-100"
          >
            Start building
          </Button>
        </div>
      </div>

      {/* Tools Section */}
      <div className="mb-16">
        <h2 className="mb-8 text-2xl font-bold">Explore pricing for tools</h2>
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {tools.map((tool) => (
            <ToolCard key={tool.name} tool={tool} />
          ))}
        </div>

        <div className="mb-8 text-sm text-neutral-500">
          *Does not include input and output tokens required to process requests
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            className="bg-white px-8 py-3 text-black hover:bg-gray-100"
          >
            Start building
          </Button>
        </div>
      </div>

      {/* Third-party Models Section */}
      <div className="mb-16">
        <h2 className="mb-8 text-2xl font-bold">Explore third-party models</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {thirdPartyModels.map((model) => (
            <ModelCard key={model.name} model={model} isThirdParty={true} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default APIPricing;
