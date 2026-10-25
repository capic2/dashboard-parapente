import { useEffect, useState } from 'react';

export function useCurrentTime() {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const nextMidnight = new Date(currentTime);
    nextMidnight.setHours(24, 0, 1, 0);
    const timeout = window.setTimeout(
      () => setCurrentTime(Date.now()),
      Math.max(0, nextMidnight.getTime() - currentTime)
    );
    return () => window.clearTimeout(timeout);
  }, [currentTime]);

  return currentTime;
}
