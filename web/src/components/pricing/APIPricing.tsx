import { Button } from "@/src/components/ui/button";

const APIPricing = () => {
  const hanzoModels = [
    {
      name: "Zen",
      fullName: "Zen - Flagship 1T+ Parameter MoDE LLM",
      description: "Our flagship model with 1T+ parameters using Mixture of Diverse Experts (MoDE) architecture. Optimal for complex reasoning, code generation, and multi-domain tasks.",
      features: ["200k context window", "MoDE architecture", "50% discount with batch processing*"],
      pricing: {
        input: "$3 / MTok",
        promptCachingWrite: "$3.75 / MTok",
        promptCachingRead: "$0.30 / MTok",
        output: "$15 / MTok"
      }
    },
    {
      name: "Sho",
      fullName: "Sho - Next-Gen Diffusion LLM",
      description: "Revolutionary diffusion model that delivers faster, cheaper inference with breakthrough efficiency. Perfect for high-throughput applications.",
      features: ["200k context window", "Diffusion architecture", "Ultra-fast inference", "50% discount with batch processing*"],
      pricing: {
        input: "$0.80 / MTok",
        promptCachingWrite: "$1 / MTok",
        promptCachingRead: "$0.08 / MTok",
        output: "$4 / MTok"
      }
    }
  ];

  const tools = [
    {
      name: "Web search",
      description: "Give Zen access to the latest information from the web",
      cost: "$10 / 1K searches*"
    },
    {
      name: "Code execution",
      description: "Run Python code in a sandboxed environment for advanced data analysis",
      details: "50 free hours of usage daily per organization",
      cost: "$0.05 per hour per container for additional usage"
    }
  ];

  const thirdPartyModels = [
    {
      name: "Claude Opus 3",
      features: ["200k context window", "50% discount with batch processing*"],
      pricing: {
        input: "$15 / MTok",
        promptCachingWrite: "$18.75 / MTok",
        promptCachingRead: "$1.50 / MTok",
        output: "$75 / MTok"
      }
    },
    {
      name: "Claude Sonnet 3.7",
      features: ["200k context window", "50% discount with batch processing*"],
      pricing: {
        input: "$3 / MTok",
        promptCachingWrite: "$3.75 / MTok",
        promptCachingRead: "$0.30 / MTok",
        output: "$15 / MTok"
      }
    }
  ];

  const ModelCard = ({ model, isThirdParty = false }) => (
    <div className="bg-gray-900/30 rounded-xl p-6 border border-gray-800/50 mb-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-2xl font-semibold mb-2">{model.fullName || model.name}</h3>
          {model.description && (
            <p className="text-neutral-400 mb-4 text-lg">{model.description}</p>
          )}

          {model.features && (
            <div className="mb-6">
              {model.features.map((feature, index) => (
                <div key={index} className="flex items-center text-sm text-neutral-400 mb-2">
                  <span className="w-2 h-2 bg-neutral-400 rounded-full mr-3"></span>
                  {feature}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ml-6">
          <Button
            className="bg-[var(--white)] text-black border border-gray-300 hover:bg-transparent hover:text-[var(--white)] hover:border-[var(--white)] transition-all duration-300"
            onClick={() => {
              // Link to cloud signup or checkout
              window.open('https://cloud.hanzo.ai/signup', '_blank');
            }}
          >
            Start Using {model.name}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-black/20 rounded-lg p-4">
        <div>
          <span className="text-neutral-500 block mb-1">Input</span>
          <div className="font-medium text-lg">{model.pricing.input}</div>
        </div>
        <div>
          <span className="text-neutral-500 block mb-1">Output</span>
          <div className="font-medium text-lg">{model.pricing.output}</div>
        </div>
        <div>
          <span className="text-neutral-500 block mb-1">Cache Write</span>
          <div className="font-medium text-lg">{model.pricing.promptCachingWrite}</div>
        </div>
        <div>
          <span className="text-neutral-500 block mb-1">Cache Read</span>
          <div className="font-medium text-lg">{model.pricing.promptCachingRead}</div>
        </div>
      </div>
    </div>
  );

  const ToolCard = ({ tool }) => (
    <div className="bg-gray-900/30 rounded-xl p-6 border border-gray-800/50">
      <h3 className="text-xl font-semibold mb-2">{tool.name}</h3>
      <p className="text-neutral-400 mb-4">{tool.description}</p>

      {tool.details && (
        <div className="flex items-center text-sm text-neutral-400 mb-3">
          <span className="w-2 h-2 bg-neutral-400 rounded-full mr-2"></span>
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
    <div className="max-w-7xl mx-auto mb-16">
      {/* Hanzo Models Section */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-4">Hanzo Foundational Models</h2>
        <p className="text-neutral-400 text-lg mb-8">Our flagship AI models built from the ground up for next-generation applications</p>
        <div className="space-y-6 mb-8">
          {hanzoModels.map((model) => (
            <ModelCard key={model.name} model={model} />
          ))}
        </div>

        <div className="text-sm text-neutral-500 mb-6">
          *Learn more about <a href="#" className="text-blue-400 hover:underline">batch processing</a>
        </div>

        <div className="text-sm text-neutral-500 mb-6">
          Customers can purchase prioritized API capacity with Priority Tier
        </div>

        <div className="text-sm text-neutral-500 mb-8">
          Prompt caching pricing is for our standard 5-minute TTL; <a href="#" className="text-blue-400 hover:underline">extended prompt caching</a> is available at an additional cost
        </div>

        <div className="flex justify-center">
          <Button size="lg" className="bg-white text-black hover:bg-gray-100 px-8 py-3">
            Start building
          </Button>
        </div>
      </div>

      {/* Tools Section */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold mb-8">Explore pricing for tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {tools.map((tool) => (
            <ToolCard key={tool.name} tool={tool} />
          ))}
        </div>

        <div className="text-sm text-neutral-500 mb-8">
          *Does not include input and output tokens required to process requests
        </div>

        <div className="flex justify-center">
          <Button size="lg" className="bg-white text-black hover:bg-gray-100 px-8 py-3">
            Start building
          </Button>
        </div>
      </div>

      {/* Third-party Models Section */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold mb-8">Explore third-party models</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {thirdPartyModels.map((model) => (
            <ModelCard key={model.name} model={model} isThirdParty={true} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default APIPricing;
