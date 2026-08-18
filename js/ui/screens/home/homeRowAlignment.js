function readHorizontalCenter(node) {
  if (!node) {
    return Number.NaN;
  }

  if (typeof node.getBoundingClientRect === "function") {
    const rect = node.getBoundingClientRect();
    const left = Number(rect?.left);
    const width = Number(rect?.width);
    if (Number.isFinite(left) && Number.isFinite(width) && width > 0) {
      return left + (width / 2);
    }
  }

  const left = Number(node.offsetLeft);
  const width = Number(node.offsetWidth);
  if (Number.isFinite(left) && Number.isFinite(width) && width > 0) {
    return left + (width / 2);
  }

  return Number.NaN;
}

function readNavigationColumn(node, fallbackIndex = 0) {
  const column = Number(node?.dataset?.navCol);
  return Number.isFinite(column) ? column : fallbackIndex;
}

export function resolveHomeVerticalTarget(rowNodes = [], sourceNode = null, fallbackCol = 0) {
  if (!Array.isArray(rowNodes) || !rowNodes.length) {
    return null;
  }

  const sourceCenter = readHorizontalCenter(sourceNode);
  const normalizedFallbackCol = Number.isFinite(Number(fallbackCol))
    ? Number(fallbackCol)
    : 0;

  if (Number.isFinite(sourceCenter)) {
    return rowNodes.reduce((best, node, index) => {
      const center = readHorizontalCenter(node);
      const distance = Number.isFinite(center)
        ? Math.abs(center - sourceCenter)
        : Number.POSITIVE_INFINITY;
      const columnDistance = Math.abs(readNavigationColumn(node, index) - normalizedFallbackCol);
      if (!best || distance < best.distance || (distance === best.distance && columnDistance < best.columnDistance)) {
        return { node, distance, columnDistance };
      }
      return best;
    }, null)?.node || rowNodes[0];
  }

  return rowNodes.reduce((best, node, index) => {
    const distance = Math.abs(readNavigationColumn(node, index) - normalizedFallbackCol);
    if (!best || distance < best.distance) {
      return { node, distance };
    }
    return best;
  }, null)?.node || rowNodes[0];
}
