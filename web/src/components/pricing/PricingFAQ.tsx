
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/src/components/ui/accordion";

const PricingFAQ = () => {
  const faqs = [
    {
      question: "How does pricing work?",
      answer: "Our pricing is based on the features and resources you need. We offer various tiers including Free, Pro, Team, and Enterprise plans. Each tier includes different levels of access to features, processing units, and support options. You can choose monthly or annual billing, with annual subscriptions offering a discount."
    },
    {
      question: "Is it free to use?",
      answer: "The free version is available to everyone. Upgrading to Plus, Team, or Enterprise offers a more powerful experience through additional features and expanded capabilities."
    },
    {
      question: "How are users counted in the Team plan?",
      answer: "Users are individuals with login access to your platform workspace. Each team member with access to your workspace counts as one user for billing purposes. End-users of your applications don't count toward this limit unless they need direct platform access."
    },
    {
      question: "What are AI Credits?",
      answer: "AI Credits represent the allocation of AI processing resources for tasks like model inference, training, and analysis. Credits can be adjusted based on your needs within the plan limits, giving you flexible control over your AI resource consumption."
    },
    {
      question: "Do you offer a plan for educational institutions?",
      answer: "Yes, we offer special pricing for educational institutions. These plans provide the same powerful features at discounted rates to support research and classroom use. Contact our sales team for details about our education-specific offerings."
    },
    {
      question: "Do you offer a discount for nonprofits?",
      answer: "Yes, qualified nonprofit organizations can receive special pricing. We're committed to supporting the important work of nonprofits by making our technology more accessible. Please contact our sales team with your nonprofit credentials to learn more."
    },
    {
      question: "How many users are supported on each subscription plan?",
      answer: "The Free plan supports a limited number of users, while Pro plans typically support a single user with expansion options. Team plans scale from 3+ users, and Enterprise plans support unlimited users. Each plan has a specific user allocation, with options to add more users as needed."
    },
    {
      question: "What are my payment options?",
      answer: "We accept all major credit cards including Visa, Mastercard, American Express, and Discover. Enterprise customers can arrange for invoice billing. All payments are processed securely through our payment provider."
    },
    {
      question: "Can I upgrade or downgrade my plan at any time?",
      answer: "Yes, you can change your plan at any time. When upgrading, the new features become available immediately and you'll be billed the prorated difference. When downgrading, changes take effect at the end of your current billing period."
    },
    {
      question: "How secure is it?",
      answer: "Security is our top priority. We use industry-standard encryption for all data, both in transit and at rest. Our infrastructure is hosted on secure cloud providers with SOC 2 compliance, and we regularly conduct security audits and penetration testing to ensure your data remains protected."
    },
    {
      question: "How is my data used?",
      answer: "We only use your data to provide and improve our services. Your content remains yours, and we don't use it to train our models without explicit permission. We have strong data governance policies that restrict access to your information, and you can request data deletion at any time."
    },
    {
      question: "Is there a free trial available?",
      answer: "Yes, we offer a 14-day free trial on our Pro plan with no credit card required. You can also start with our Free plan which is free forever, then upgrade when you need more resources or features."
    },
    {
      question: "What happens if I exceed my plan's resource limits?",
      answer: "If you reach your resource limits, you'll receive a notification with options to upgrade your plan or adjust your resource allocation. We don't automatically charge for overages, allowing you to make informed decisions about your usage."
    },
    {
      question: "Do you offer discounts for annual billing?",
      answer: "Yes, we offer a 10% discount when you choose annual billing on any of our paid plans. This option is available during signup or from your billing settings."
    }
  ];

  return (
    <div className="max-w-3xl mx-auto my-16 px-4">
      <h2 className="text-2xl font-bold mb-8 text-center">Frequently Asked Questions</h2>

      <Accordion type="single" collapsible className="border-gray-800">
        {faqs.map((faq, index) => (
          <AccordionItem
            key={index}
            value={`item-${index}`}
            className="border-b border-gray-800"
          >
            <AccordionTrigger className="py-4 text-left text-neutral-200 hover:text-[var(--white)]">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-neutral-400 pb-4">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default PricingFAQ;
