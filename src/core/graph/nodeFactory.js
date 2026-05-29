/**
 * @author: zhjj
 */
import { cloneColumns } from "../catalog/datasets.js";
import { createOperatorConfig, operatorMap } from "../catalog/operators.js";

let idSeed = 1;

const nextId = (prefix) => `${prefix}${Date.now()}_${idSeed++}`;

const baseNode = (overrides) => ({
  id: nextId("node_"),
  x: 120,
  y: 120,
  width: 204,
  height: 72,
  selected: false,
  ...overrides,
});

export const createDatasetNode = (dataset, position = { x: 100, y: 100 }) =>
  baseNode({
    id: nextId("source_"),
    kind: "dataset",
    category: "bsr_",
    title: dataset.label,
    subtitle: `${dataset.schema}.${dataset.table}`,
    x: position.x,
    y: position.y,
    data: {
      datasetId: dataset.id,
      schema: dataset.schema,
      table: dataset.table,
      label: dataset.label,
      description: dataset.description,
      columns: cloneColumns(dataset.columns),
      selectedColumns: dataset.columns.map((column) => column.name),
      extraColumns: [],
    },
  });

export const createOperatorNode = (category, position = { x: 320, y: 160 }) => {
  const meta = operatorMap[category];
  return baseNode({
    id: nextId("operator_"),
    kind: "operator",
    category,
    title: meta?.label || category,
    subtitle: meta?.description || "",
    x: position.x,
    y: position.y,
    data: createOperatorConfig(category),
  });
};

export const cloneNode = (node) => JSON.parse(JSON.stringify(node));

export const createEdge = ({ sourceId, sourceHandle = "out", targetId, targetHandle = "in" }) => ({
  id: nextId("edge_"),
  sourceId,
  sourceHandle,
  targetId,
  targetHandle,
});
