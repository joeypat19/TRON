export function buildLabelModification(
  currentLabelIds: string[],
  nextStarred: boolean,
) {
  const hasStar = currentLabelIds.includes("STARRED");

  return {
    addLabelIds: nextStarred && !hasStar ? ["STARRED"] : [],
    removeLabelIds: !nextStarred && hasStar ? ["STARRED"] : [],
  };
}
