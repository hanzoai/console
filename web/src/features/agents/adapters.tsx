/**
 * Drop-in shim for react-router-dom APIs → Next.js Pages Router.
 *
 * Every Hanzo Agents component that imported from "react-router-dom" now
 * imports from this module instead (bulk-replaced at copy time).
 */
import NextLink from "next/link";
import { useRouter } from "next/router";
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// useParams
// ---------------------------------------------------------------------------
export function useParams<
  T extends Record<string, string> = Record<string, string>,
>(): T {
  const router = useRouter();
  return router.query as unknown as T;
}

// ---------------------------------------------------------------------------
// useNavigate
// ---------------------------------------------------------------------------
export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (to: string | number, options?: { replace?: boolean }) => {
      if (typeof to === "number") {
        if (to === -1) router.back();
        return;
      }
      const projectId = router.query.projectId as string;
      const basePath = `/project/${projectId}/agents`;
      const fullPath = to.startsWith("/") ? `${basePath}${to}` : to;
      if (options?.replace) {
        void router.replace(fullPath);
      } else {
        void router.push(fullPath);
      }
    },
    [router],
  );
}

// ---------------------------------------------------------------------------
// useLocation
// ---------------------------------------------------------------------------
export function useLocation() {
  const router = useRouter();
  return useMemo(
    () => ({
      pathname: router.asPath.split("?")[0],
      search: router.asPath.includes("?")
        ? `?${router.asPath.split("?")[1]}`
        : "",
      hash: "",
      state: null as unknown,
      key: "default",
    }),
    [router.asPath],
  );
}

// ---------------------------------------------------------------------------
// useSearchParams  (matches react-router-dom's two-arg setSearchParams)
// ---------------------------------------------------------------------------
type NavigateOptions = { replace?: boolean; state?: unknown };

export function useSearchParams(): [
  URLSearchParams,
  (
    nextInit:
      | URLSearchParams
      | Record<string, string>
      | ((prev: URLSearchParams) => URLSearchParams),
    opts?: NavigateOptions,
  ) => void,
] {
  const router = useRouter();

  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(router.query)) {
      if (typeof v === "string") params.set(k, v);
    }
    return params;
  }, [router.query]);

  const setSearchParams = useCallback(
    (
      nextInit:
        | URLSearchParams
        | Record<string, string>
        | ((prev: URLSearchParams) => URLSearchParams),
      _opts?: NavigateOptions,
    ) => {
      const next =
        typeof nextInit === "function" ? nextInit(searchParams) : nextInit;
      const qs =
        next instanceof URLSearchParams
          ? next.toString()
          : new URLSearchParams(next).toString();
      void router.replace(
        { pathname: router.pathname, query: qs ? `?${qs}` : undefined },
        undefined,
        { shallow: true },
      );
    },
    [router, searchParams],
  );

  return [searchParams, setSearchParams];
}

// ---------------------------------------------------------------------------
// Link — maps react-router-dom <Link to="..."> to next/link <Link href="...">
// ---------------------------------------------------------------------------
interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  replace?: boolean;
  children?: ReactNode;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, replace: replaceProp, children, ...rest },
  ref,
) {
  return (
    <NextLink href={to} replace={replaceProp} ref={ref} {...rest}>
      {children}
    </NextLink>
  );
});

// ---------------------------------------------------------------------------
// NavLink — active-aware link with render-prop children support
// ---------------------------------------------------------------------------
interface NavLinkProps extends Omit<LinkProps, "className" | "children"> {
  className?: string | ((props: { isActive: boolean }) => string);
  children?: ReactNode | ((props: { isActive: boolean }) => ReactNode);
  end?: boolean;
}

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  function NavLink({ className, children, to, end, ...rest }, ref) {
    const router = useRouter();
    const currentPath = router.asPath.split("?")[0];
    const isActive = end ? currentPath === to : currentPath.startsWith(to);

    const cls =
      typeof className === "function" ? className({ isActive }) : className;

    const resolvedChildren =
      typeof children === "function" ? children({ isActive }) : children;

    return (
      <Link to={to} ref={ref} className={cls} {...rest}>
        {resolvedChildren}
      </Link>
    );
  },
);

// ---------------------------------------------------------------------------
// Navigate — redirect component
// ---------------------------------------------------------------------------
export function Navigate({
  to,
  replace: replaceProp = true,
}: {
  to: string;
  replace?: boolean;
}) {
  const router = useRouter();
  useEffect(() => {
    if (replaceProp) {
      void router.replace(to);
    } else {
      void router.push(to);
    }
  }, [to, replaceProp, router]);
  return null;
}

// ---------------------------------------------------------------------------
// Re-export stubs for Route/Routes/BrowserRouter (only used in App.tsx which
// we don't use — these prevent import errors).
// ---------------------------------------------------------------------------
export const Route = (_props: Record<string, unknown>) => null;
export const Routes = ({ children }: { children?: ReactNode }) => (
  <>{children}</>
);
export const BrowserRouter = ({
  children,
}: {
  children?: ReactNode;
  basename?: string;
}) => <>{children}</>;
