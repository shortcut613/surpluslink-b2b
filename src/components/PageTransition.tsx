import { useRouterState } from "@tanstack/react-router";

interface PageTransitionProps {
  children: React.ReactNode;
  /** Extra classes to add to the wrapper (e.g. "flex-1") */
  className?: string;
}

/**
 * Wraps page content with a smooth fade+slide-up animation on every route change.
 *
 * Uses the current pathname as a React `key` so the div unmounts and remounts
 * on navigation, re-triggering the CSS `page-transition` keyframe each time.
 *
 * The layout chrome (sidebar, top bar) sits outside this component and stays
 * visually stable — only the content area animates.
 */
export function PageTransition({ children, className = "" }: PageTransitionProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div key={pathname} className={`page-transition ${className}`}>
      {children}
    </div>
  );
}
