z
import { Button } from "@/src/components/ui/radix-button";
import { CreditCard } from "lucide-react";
import { z } from "zod";

const BillingManagement = () => {
  return (
    <div className="max-w-4xl mx-auto mb-16 p-8 rounded-xl border border-white/5 backdrop-blur-xl bg-[var(--black)] hover:border-white/10 transition-all">
      <div className="flex items-center gap-4 mb-5">
        <CreditCard className="h-8 w-8 text-[var(--white)]" />
        <h2 className="text-2xl font-medium">Billing Management</h2>
      </div>
      <p className="text-neutral-300 mb-6 leading-relaxed">
        Manage your subscription easily. Need assistance? Join our Discord server for immediate support.
      </p>
      <div className="flex flex-wrap gap-4">
        <Button className="bg-[var(--black)] hover:bg-neutral-900 text-[var(--white)] border border-white/10 px-6 py-6">
          Manage Subscription
        </Button>
        <Button
          variant="outline"
          className="border-white/10 hover:bg-[var(--white)]/5 px-6 py-6"
          onClick={() => window.open('https://discord.com/invite/XthHQQj', '_blank')}
        >
          Join Discord
        </Button>
      </div>
    </div>
  );
};

export default BillingManagement;
