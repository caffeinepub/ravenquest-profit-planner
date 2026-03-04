import { useEffect, useState } from "react";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";

interface UseIsAdminResult {
  isAdmin: boolean;
  isChecking: boolean;
}

export function useIsAdmin(): UseIsAdminResult {
  const { identity } = useInternetIdentity();
  const { actor, isFetching } = useActor();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Not logged in — definitely not admin
    if (!identity) {
      setIsAdmin(false);
      setIsChecking(false);
      return;
    }

    // Actor still initialising — wait
    if (isFetching || !actor) {
      setIsChecking(true);
      return;
    }

    setIsChecking(true);
    actor
      .isCallerAdmin()
      .then((result) => {
        setIsAdmin(result);
      })
      .catch(() => {
        setIsAdmin(false);
      })
      .finally(() => {
        setIsChecking(false);
      });
  }, [identity, actor, isFetching]);

  return { isAdmin, isChecking };
}
