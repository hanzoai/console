import React, { useEffect, useState, memo } from "react";

interface CountdownProps {
  expiredAt: Date;
}

const CountdownTimer: React.FC<CountdownProps> = ({ expiredAt }) => {
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!expiredAt) return;

    const timer = setInterval(() => {
      const now = new Date();
      const timeDiff = expiredAt.getTime() - now.getTime();

      if (timeDiff <= 0) {
        setCountdown("Expired");
        clearInterval(timer);
        return;
      }

      const hours = Math.floor(
        (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

      setCountdown(`${hours}h ${minutes}m ${seconds}s`);
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
