// eslint-disable-file import/no-extraneous-dependencies
import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  useSelector, useDispatch,
} from 'react-redux';
import PropTypes from 'prop-types';
import _ from 'lodash';
import * as vega from 'vega';

import Loader from '../../Loader';
import 'vitessce/dist/es/production/static/css/index.css';
import ClusterPopover from './ClusterPopover';
import CrossHair from './CrossHair';
import CellInfo from '../CellInfo';
import { loadEmbedding } from '../../../redux/actions/embedding';
import { createCellSet } from '../../../redux/actions/cellSets';
import { loadGeneExpression } from '../../../redux/actions/genes';

import { updateCellInfo } from '../../../redux/actions/cellInfo';
import {
  convertCellsData,
  updateStatus,
  clearPleaseWait,
  renderCellSetColors,
  colorByGeneExpression,
  colorInterpolator,
} from '../../../utils/embeddingPlotHelperFunctions/helpers';
import PlatformError from '../../PlatformError';

import { loadProcessingSettings } from '../../../redux/actions/experimentSettings';
import { getCellSets } from '../../../redux/selectors';

const Scatterplot = dynamic(
  () => import('vitessce/dist/umd/production/scatterplot.min').then((mod) => mod.Scatterplot),
  { ssr: false },
);

const cellRadiusFromZoom = (zoom) => zoom ** 3 / 50;

const Embedding = (props) => {
  const {
    experimentId, height, width,
  } = props;

  const dispatch = useDispatch();

  const [view, setView] = useState({ target: [4, -4, 0], zoom: 4.00 });
  const [cellRadius, setCellRadius] = useState(cellRadiusFromZoom(4.00));

  const selectedCellIds = new Set();

  const embeddingSettings = useSelector(
    (state) => state.experimentSettings?.originalProcessing?.configureEmbedding?.embeddingSettings,
  );
  const embeddingType = embeddingSettings?.method;

  const { data, loading, error } = useSelector((state) => state.embeddings[embeddingType]) || {};

  const focusData = useSelector((state) => state.cellInfo.focus);
  const focusedExpression = useSelector((state) => state.genes.expression.data[focusData.key]);
  const {
    properties: cellSetProperties,
    hierarchy: cellSetHierarchy,
    hidden: cellSetHidden,
  } = useSelector(getCellSets());

  const selectedCell = useSelector((state) => state.cellInfo.cellName);
  const expressionLoading = useSelector((state) => state.genes.expression.loading);
  const loadedGenes = useSelector((state) => Object.keys(state.genes.expression.data));

  const cellCoordintes = useRef({ x: 200, y: 300 });
  const [createClusterPopover, setCreateClusterPopover] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [cellColors, setCellColors] = useState({});
  const [clusterKeyToNameMap, setClusterKeyToNameMap] = useState({});
  const [cellSetClusters, setCellSetClusters] = useState({});
  const [cellInfoVisible, setCellInfoVisible] = useState(true);

  // Load embedding settings if they aren't already.
  useEffect(() => {
    if (!embeddingSettings) {
      dispatch(loadProcessingSettings(experimentId));
    }
  }, []);

  // Then, try to load the embedding with the appropriate data.
  useEffect(() => {
    if (embeddingSettings && !data) {
      dispatch(loadEmbedding(experimentId, embeddingType));
    }
  }, [embeddingSettings]);

  // Handle focus change (e.g. a cell set or gene or metadata got selected).
  // Also handle here when the cell set properties or hierarchy change.
  useEffect(() => {
    const { store, key } = focusData;

    switch (store) {
      // For genes/continous data, we cannot do this in one go,
      // we need to wait for the thing to load in first.
      case 'genes': {
        dispatch(loadGeneExpression(experimentId, [key], 'embedding'));
        setCellInfoVisible(false);
        return;
      }

      // Cell sets are easy, just return the appropriate color and set them up.
      case 'cellSets': {
        setCellColors(renderCellSetColors(key, cellSetHierarchy, cellSetProperties));
        setCellInfoVisible(false);
        return;
      }

      // If there is no focus, we can just delete all the colors.
      default: {
        setCellColors({});
        setCellInfoVisible(false);
        break;
      }
    }
  }, [focusData, cellSetHierarchy, cellSetProperties]);

  // Handle loading of expression for focused gene.
  useEffect(() => {
    if (!focusedExpression) {
      return;
    }

    setCellColors(colorByGeneExpression(focusedExpression));
  }, [focusedExpression]);

  useEffect(() => {
    if (cellSetHierarchy) {
      const mapping = cellSetHierarchy.reduce((keyToClusterNameMap, rootHierarchy) => {
        if (rootHierarchy.children.length > 0) {
          rootHierarchy.children.forEach((child) => {
            // eslint-disable-next-line no-param-reassign
            keyToClusterNameMap[child.key] = _.capitalize(rootHierarchy.key);
          });
        }
        return keyToClusterNameMap;
      }, {});
      setClusterKeyToNameMap(mapping);
    }

    if (cellSetProperties) {
      setCellSetClusters(Object.entries(cellSetProperties).filter(([key, cellSet]) => cellSet.type === 'cellSets'));
    }
  }, [cellSetProperties, cellSetHierarchy]);

  const updateCellCoordinates = (newView) => {
    if (selectedCell && newView.project) {
      const [x, y] = newView.project(selectedCell);
      cellCoordintes.current = {
        x,
        y,
        width,
        height,
      };
    }
  };

  const getContainingCellSets = (cellId) => {
    const prefixedCellSetNames = cellSetClusters
      .filter(([, cellSet]) => cellSet.cellIds.has(Number.parseInt(cellId, 10)))
      .map(([key, containingCellset]) => `${clusterKeyToNameMap[key]}: ${containingCellset.name}`);

    return prefixedCellSetNames;
  };

  const updateCellsHover = (cell) => {
    if (cell) {
      if (focusData.store === 'genes') {
        const expressionToDispatch = focusedExpression
          ? focusedExpression.rawExpression.expression[cell] : undefined;

        return dispatch(updateCellInfo({
          cellName: cell,
          cellSets: getContainingCellSets(cell),
          geneName: focusData.key,
          expression: expressionToDispatch,
          componentType: embeddingType,
        }));
      }

      return dispatch(updateCellInfo({
        cellName: cell,
        cellSets: getContainingCellSets(cell),
        geneName: undefined,
        expression: undefined,
        componentType: embeddingType,
      }));
    }
  };

  const onCreateCluster = (clusterName, clusterColor) => {
    setCreateClusterPopover(false);
    dispatch(createCellSet(experimentId, clusterName, clusterColor, selectedIds));
  };

  const onCancelCreateCluster = () => {
    setCreateClusterPopover(false);
  };

  const updateCellsSelection = (selection) => {
    if (selection.length > 0) {
      setCreateClusterPopover(true);
      setSelectedIds(selection);
    }
  };

  // Embedding data is loading.
  if (!data || loading) {
    return (<center><Loader experimentId={experimentId} size='large' /></center>);
  }

  // The selected gene in can be present in both expression.loading and expression.data.
  // To make sure that the gene is really loading, we have to check if it exists in the loading array
  // and is not present in the data array
  if (focusData.store === 'genes'
    && !loadedGenes.includes(focusData.key)
    && expressionLoading.includes(focusData.key)) {
    return (<center><Loader experimentId={experimentId} size='large' /></center>);
  }

  // The embedding couldn't load. Display an error condition.
  if (error) {
    return (
      <PlatformError
        error={error}
        onClick={() => dispatch(loadEmbedding(experimentId, embeddingType))}
      />
    );
  }

  const renderExpressionView = () => {
    if (focusData.store === 'genes') {
      const colorScale = vega.scale('sequential')()
        .interpolator(colorInterpolator);

      return (
        <div>
          <label htmlFor='continuous data name'>
            <strong>{focusData.key}</strong>
          </label>
          <div
            style={{
              position: 'absolute',
              background: `linear-gradient(${colorScale(1)}, ${colorScale(0)})`,
              height: 200,
              width: 20,
              top: 70,
            }}
          />
        </div>
      );
    }

    if (focusData.store === 'cellSets') {
      return (
        <div>
          <label htmlFor='cell set name'>
            <strong>{cellSetProperties[focusData.key] ? cellSetProperties[focusData.key].name : ''}</strong>
          </label>
        </div>
      );
    }

    return <div />;
  };

  return (
    <div
      className='vitessce-container vitessce-theme-light'
      style={{ width, height, position: 'relative' }}
      // make sure that the crosshairs don't break zooming in and out of the embedding
      onWheel={() => { setCellInfoVisible(false); }}
      onMouseMove={() => {
        if (!cellInfoVisible) {
          setCellInfoVisible(true);
        }
      }}
    >
      {renderExpressionView()}
      {
        data ? (
          <Scatterplot
            cellOpacity={0.8}
            cellRadius={cellRadius}
            setCellHighlight={updateCellsHover}
            // setCellSelection={updateCellsHover}
            theme='light'
            uuid={embeddingType}
            viewState={view}
            updateViewInfo={updateCellCoordinates}
            cells={convertCellsData(data, cellSetHidden, cellSetProperties)}
            mapping='PCA'
            cellSelection={selectedCellIds}
            cellColors={
              (selectedCell)
                ? new Map(Object.entries({ ...cellColors, [selectedCell]: [0, 0, 0] }))
                : new Map(Object.entries(cellColors))
            }
            setViewState={({ zoom, target }) => {
              setCellRadius(cellRadiusFromZoom(zoom));

              setView({ zoom, target });
            }}
            getExpressionValue={() => { }}
            getCellIsSelected={() => { }}
            setCellSelection={updateCellsSelection}

          />
        ) : ''
      }
      {
        createClusterPopover
          ? (
            <ClusterPopover
              visible
              popoverPosition={cellCoordintes}
              onCreate={onCreateCluster}
              onCancel={onCancelCreateCluster}
            />
          ) : (
            cellInfoVisible ? (
              <div>
                <CellInfo
                  componentType={embeddingType}
                  coordinates={cellCoordintes}
                />
                <CrossHair
                  componentType={embeddingType}
                  coordinates={cellCoordintes}
                />
              </div>
            ) : <></>
          )
      }
    </div>
  );
};

Embedding.defaultProps = {};

Embedding.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  experimentId: PropTypes.string.isRequired,
};
export default Embedding;
