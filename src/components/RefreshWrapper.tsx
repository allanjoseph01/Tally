"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RefreshWrapper() {
  const router = useRouter();

  useEffect(() => {
    // Automatically trigger router refresh every 30 seconds to fetch fresh stock numbers
    const interval = setInterval(() => {
      router.refresh();
    }, 30000);

    return () => clearInterval(interval);
  }, [router]);

  return null;
}
