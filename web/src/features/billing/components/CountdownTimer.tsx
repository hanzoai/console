import React, { useEffect, useState, memo } from "react";
import { api } from "@/src/utils/api"; // Sử dụng React Query
import { showErrorToast } from "@/src/features/notifications/showErrorToast";

interface CountdownProps {
  expiredAt: Date;
  orgId: string;
}

const CountdownTimer: React.FC<CountdownProps> = ({ expiredAt, orgId }) => {
  const [countdown, setCountdown] = useState("");
  const updateCredits = api.organizations.updateCredits.useMutation();

  useEffect(() => {
    if (!expiredAt) {
      return;
    } else {
      const now = new Date();
      const timeDiff = expiredAt.getTime() - now.getTime();
      if (timeDiff <= 0) {
        setCountdown("Expired");
        return;
      }
    }

    const timer = setInterval(() => {
      const now = new Date();
      const timeDiff = expiredAt.getTime() - now.getTime();

      if (timeDiff <= 0) {
        setCountdown("Expired");
        clearInterval(timer);

        updateCredits.mutate(
          { orgId, credits: 0 },
          {
            onSuccess: () => {
              window.location.reload();
            },
            onError: (err) => {
              console.log("Err orrur when updating credits", err);
              showErrorToast(
                "Error when updating credit",
                err.message,
                "ERROR",
              );
            },
          },
        );
        return;
      }

      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      // const hours = Math.floor(
      //   (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      // );
      // const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      // const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
      //${hours}h ${minutes}m ${seconds}s
      setCountdown(`${days}d `);
    }, 1000);

    return () => clearInterval(timer);
  }, [expiredAt]);

  return (
    <p className="text-sm text-muted-foreground">
      {countdown !== "Expired" ? (
        <span>
          Expires in: <span className="font-bold">{countdown}</span>
        </span>
      ) : (
        <span className="text-red-500">This plan has expired.</span>
      )}
    </p>
  );
};

export default memo(CountdownTimer);
