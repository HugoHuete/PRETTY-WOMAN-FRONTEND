import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";

type PageHeading = {
  title: string;
  breadcrumbs: ReactNode;
};

type PageActionsContextValue = {
  action: ReactNode;
  setAction: (action: ReactNode) => void;
  heading: PageHeading | null;
  setHeading: (heading: PageHeading | null) => void;
};

const PageActionsContext = createContext<PageActionsContextValue | null>(null);

export function PageActionsProvider({ children }: PropsWithChildren) {
  const [action, setActionState] = useState<ReactNode>(null);
  const [heading, setHeading] = useState<PageHeading | null>(null);
  const setAction = useCallback(
    (nextAction: ReactNode) => setActionState(nextAction),
    [],
  );
  const value = useMemo(
    () => ({ action, setAction, heading, setHeading }),
    [action, setAction, heading],
  );

  return (
    <PageActionsContext.Provider value={value}>
      {children}
    </PageActionsContext.Provider>
  );
}

export function usePageActions() {
  const context = useContext(PageActionsContext);
  if (!context)
    throw new Error(
      "usePageActions debe utilizarse dentro de PageActionsProvider.",
    );
  return context;
}
