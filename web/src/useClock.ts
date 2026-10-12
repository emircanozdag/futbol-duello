import { useEffect, useState } from "react";

let offset = 0;
export const syncClock = (serverNow: number) => { offset = serverNow - Date.now(); };
export const serverNow = () => Date.now() + offset;

/** deadline'a kalan ms (100 ms'de bir güncellenir) */
export function useRemaining(deadline: number) {
  const [left, setLeft] = useState(() => Math.max(0, deadline - serverNow()));
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, deadline - serverNow()));
    tick();
    const t = setInterval(tick, 100);
    return () => clearInterval(t);
  }, [deadline]);
  return left;
}
