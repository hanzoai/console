import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { Button } from "./button";
import { Card, CardContent } from "./card";

export interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  persistent?: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id">) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return context;
}

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, "id">): string => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? 5000,
    };

    setNotifications((prev) => [...prev, newNotification]);

    // Auto-remove after duration (unless persistent)
    if (!notification.persistent && newNotification.duration! > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearAll,
      }}
    >
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
}

function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onClose: () => void;
}

function NotificationItem({ notification, onClose }: NotificationItemProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200); // Wait for animation
  };

  const getNotificationStyles = (type: Notification["type"]) => {
    switch (type) {
      case "success":
        return {
          icon: "✅",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
          textColor: "text-green-800",
          badgeColor: "bg-green-100 text-green-700",
        };
      case "error":
        return {
          icon: "❌",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
          textColor: "text-red-800",
          badgeColor: "bg-red-100 text-red-700",
        };
      case "warning":
        return {
          icon: "⚠️",
          bgColor: "bg-yellow-50",
          borderColor: "border-yellow-200",
          textColor: "text-yellow-800",
          badgeColor: "bg-yellow-100 text-yellow-700",
        };
      case "info":
        return {
          icon: "ℹ️",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-200",
          textColor: "text-blue-800",
          badgeColor: "bg-blue-100 text-blue-700",
        };
    }
  };

  const styles = getNotificationStyles(notification.type);

  return (
    <Card
      className={`
        ${styles.bgColor} ${styles.borderColor} shadow-lg
        transform transition-all duration-200 ease-in-out
        ${
          isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
        }
      `}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <span className="text-heading-3 flex-shrink-0 mt-0.5" aria-hidden="true">
            {styles.icon}
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h4 className={`font-medium text-sm ${styles.textColor}`}>
                {notification.title}
              </h4>
              <button
                onClick={handleClose}
                className={`${styles.textColor} hover:opacity-70 transition-opacity`}
                aria-label="Close notification"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {notification.message && (
              <p className={`text-xs ${styles.textColor} opacity-90 mb-2`}>
                {notification.message}
              </p>
            )}

            {notification.action && (
              <Button
                size="sm"
                variant="outline"
                onClick={notification.action.onClick}
                className={`text-xs ${styles.badgeColor} border-current`}
              >
                {notification.action.label}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Convenience hooks for common notification types
export function useSuccessNotification() {
  const { addNotification } = useNotifications();

  return (title: string, message?: string, action?: Notification["action"]) => {
    return addNotification({
      type: "success",
      title,
      message,
      action,
      duration: 4000,
    });
  };
}

export function useErrorNotification() {
  const { addNotification } = useNotifications();

  return (title: string, message?: string, action?: Notification["action"]) => {
    return addNotification({
      type: "error",
      title,
      message,
      action,
      duration: 6000,
    });
  };
}

export function useInfoNotification() {
  const { addNotification } = useNotifications();

  return (title: string, message?: string, action?: Notification["action"]) => {
    return addNotification({
      type: "info",
      title,
      message,
      action,
      duration: 5000,
    });
  };
}

export function useWarningNotification() {
  const { addNotification } = useNotifications();

  return (title: string, message?: string, action?: Notification["action"]) => {
    return addNotification({
      type: "warning",
      title,
      message,
      action,
      duration: 5000,
    });
  };
}

// DID/VC specific notification hooks
export function useDIDNotifications() {
  const success = useSuccessNotification();
  const error = useErrorNotification();
  const info = useInfoNotification();

  return {
    didCopied: (type: string = "DID") =>
      success(`${type} Copied`, `${type} has been copied to clipboard`),

    didRegistered: (nodeId: string) =>
      success("DID Registered", `DID identity registered for node ${nodeId}`),

    didError: (message: string) => error("DID Operation Failed", message),

    didRefreshed: () =>
      info("DID Data Refreshed", "DID information has been updated"),
  };
}

export function useVCNotifications() {
  const success = useSuccessNotification();
  const error = useErrorNotification();
  const info = useInfoNotification();

  return {
    vcCopied: () =>
      success("VC Copied", "Verifiable Credential copied to clipboard"),

    vcDownloaded: (filename?: string) =>
      success(
        "VC Downloaded",
        filename ? `Downloaded as ${filename}` : "VC document downloaded"
      ),

    vcVerified: (valid: boolean) =>
      valid
        ? success("VC Verified", "Verifiable Credential is valid and verified")
        : error(
            "VC Verification Failed",
            "Verifiable Credential verification failed"
          ),

    vcError: (message: string) => error("VC Operation Failed", message),

    vcChainLoaded: (count: number) =>
      info("VC Chain Loaded", `Loaded ${count} verification credentials`),
  };
}
