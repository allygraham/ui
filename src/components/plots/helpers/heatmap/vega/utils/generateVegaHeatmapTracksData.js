const generateVegaHeatmapTracksData = (cells, track, cellSets, heatmapSettings) => {
  const { hierarchy, properties } = cellSets;

  const getCellClusterFromCellId = (clusters, cellId) => {
    let cluster;
    clusters.forEach(({ key }) => {
      if (properties[key].cellIds.has(cellId)) {
        cluster = key;
      }
    });
    return cluster;
  };

  // Find the `groupBy` root node.
  const rootNodes = hierarchy.filter((clusters) => clusters.key === track);

  if (!rootNodes.length) {
    return [];
  }

  const childrenCellSets = [];
  rootNodes.forEach((rootNode) => childrenCellSets.push(...rootNode.children));

  const trackColorData = [];
  const groupData = [];
  // Iterate over each child node.

  const clusterSeparationLines = [];
  if (heatmapSettings.guardLines) {
    let currentCluster = getCellClusterFromCellId(childrenCellSets, cells[0]);
    cells.forEach((cell) => {
      const isTheSameCluster = properties[currentCluster]?.cellIds?.has(cell);
      if (!isTheSameCluster) {
        currentCluster = getCellClusterFromCellId(childrenCellSets, cell);
        clusterSeparationLines.push(cell);
      }
    });
  }
  childrenCellSets.forEach(({ key }) => {
    const { cellIds, name, color } = properties[key];

    groupData.push({
      key,
      track,
      name,
      color,
      trackName: properties[track].name,
    });

    const intersectionSet = [cellIds, cells].reduce(
      (acc, curr) => new Set([...acc].filter((x) => curr.has(x))),
    );

    intersectionSet.forEach((cellId) => trackColorData.push({
      cellId,
      key,
      track,
      color,
    }));
  });
  return { trackColorData, groupData, clusterSeparationLines };
};

export default generateVegaHeatmapTracksData;
