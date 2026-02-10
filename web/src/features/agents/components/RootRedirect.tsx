import { Navigate } from "../adapters";

export function RootRedirect() {
  return <Navigate to="/dashboard" replace />;
}
