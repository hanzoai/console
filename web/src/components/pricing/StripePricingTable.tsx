
import React, { useEffect } from "react";

const StripePricingTable = () => {
  useEffect(() => {
    // Load Stripe pricing table script
    const script = document.createElement('script');
    script.src = "https://js.stripe.com/v3/pricing-table.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto mb-16">
      <div className="stripe-pricing-table">
        <div
          dangerouslySetInnerHTML={{
            __html: `
              <script async src="https://js.stripe.com/v3/pricing-table.js"></script>
              <stripe-pricing-table
                pricing-table-id="prctbl_1OuWBqCXWvTtjTI7GiQiLlhq"
                publishable-key="pk_live_51OIbM0CXWvTtjTI7mbcOsQiQxciFdRhW4lOmW7rIIxZRQn5hNUlSJLNHes0nWTmwkR2bYlQ6SNeTiYxOAd7JOgbJ00bF3H5rCM"
              ></stripe-pricing-table>
            `
          }}
        />
      </div>
    </div>
  );
};

export default StripePricingTable;
