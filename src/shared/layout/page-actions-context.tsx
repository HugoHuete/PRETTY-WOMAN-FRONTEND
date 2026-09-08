import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";

type PageActionsContextValue = {
  action: ReactNode;
  setAction: (action: ReactNode) => void;
};

const PageActionsContext = createContext<PageActionsContextValue | null>(null);

export function PageActionsProvider({ children }: PropsWithChildren) {
  const [action, setActionState] = useState<ReactNode>(null);
  const setAction = useCallback(
    (nextAction: ReactNode) => setActionState(nextAction),
    [],
  );
  const value = useMemo(() => ({ action, setAction }), [action, setAction]);

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
