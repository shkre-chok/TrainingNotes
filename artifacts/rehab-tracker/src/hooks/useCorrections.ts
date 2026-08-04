import { useMemo } from "react";
import { useListCorrections, getListCorrectionsQueryKey } from "@workspace/api-client-react";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function applyCorrections(
  text: string,
  corrections: Array<{ raw: string; corrected: string }>
): string {
  if (!corrections.length || !text.trim()) return text;
  let result = text;
  for (const { raw, corrected } of corrections) {
    if (!raw.trim()) continue;
    // Case-insensitive, word-boundary aware replacement
    const pattern = escapeRegex(raw.trim());
    const regex = new RegExp(`(?<![\\wא-ת])${pattern}(?![\\wא-ת])`, "gi");
    result = result.replace(regex, corrected);
  }
  return result;
}

export function useCorrections() {
  const { data: corrections = [], isLoading } = useListCorrections({
    query: { queryKey: getListCorrectionsQueryKey() },
  });

  const apply = useMemo(
    () => (text: string) => applyCorrections(text, corrections),
    [corrections]
  );

  return { corrections, isLoading, apply };
}
