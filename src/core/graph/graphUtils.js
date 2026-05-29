/**
 * @author: zhjj
 */
import { binaryCategories } from "../catalog/operators.js";

export const byId = (items) => Object.fromEntries(items.map((item) => [item.id, item]));

export const getIncomingEdges = (edges, nodeId) => edges.filter((edge) => edge.targetId === nodeId);

export const getOutgoingEdges = (edges, nodeId) => edges.filter((edge) => edge.sourceId === nodeId);

export const getRequiredInputHandles = (node) => {
  if (!node) {
    return [];
  }
  if (node.kind === "dataset") {
    return [];
  }
  if (binaryCategories.has(node.category)) {
    return ["left", "right"];
  }
  return ["in"];
};

export const getIncomingMap = (edges, nodeId) => {
  const mapping = {};
  for (const edge of getIncomingEdges(edges, nodeId)) {
    mapping[edge.targetHandle || "in"] = edge.sourceId;
  }
  return mapping;
};

export const canAcceptConnection = (nodes, edges, sourceId, targetId, targetHandle) => {
  if (sourceId === targetId) {
    return { ok: false, message: "不能连接到自己。" };
  }
  const nodeMap = byId(nodes);
  const sourceNode = nodeMap[sourceId];
  const targetNode = nodeMap[targetId];
  if (!sourceNode || !targetNode) {
    return { ok: false, message: "连接目标不存在。" };
  }
  if (sourceNode.kind === "operator" && sourceNode.category === "bsc_") {
    return { ok: false, message: "输出表不能继续向下游输出。" };
  }
  const existing = edges.find(
    (edge) =>
      edge.sourceId === sourceId &&
      edge.targetId === targetId &&
      (edge.targetHandle || "in") === (targetHandle || "in")
  );
  if (existing) {
    return { ok: false, message: "相同的连线已经存在。" };
  }
  const currentIncoming = getIncomingMap(edges, targetId);
  if (currentIncoming[targetHandle || "in"]) {
    return { ok: false, message: "这个输入端口已经被占用。" };
  }
  if (wouldCreateCycle(edges, sourceId, targetId)) {
    return { ok: false, message: "这条连线会形成循环依赖。" };
  }
  return { ok: true, message: "" };
};

export const wouldCreateCycle = (edges, sourceId, targetId) => {
  const adjacency = {};
  for (const edge of edges) {
    adjacency[edge.sourceId] ||= [];
    adjacency[edge.sourceId].push(edge.targetId);
  }
  adjacency[sourceId] ||= [];
  adjacency[sourceId].push(targetId);

  const queue = [targetId];
  const visited = new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === sourceId) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    for (const next of adjacency[current] || []) {
      queue.push(next);
    }
  }
  return false;
};

export const removeNodeWithEdges = (nodes, edges, nodeId) => ({
  nodes: nodes.filter((node) => node.id !== nodeId),
  edges: edges.filter((edge) => edge.sourceId !== nodeId && edge.targetId !== nodeId),
});

export const pickFirstOutputNode = (nodes) => nodes.find((node) => node.category === "bsc_") || null;

export const exportGraphSnapshot = ({ nodes, edges, dialect }) =>
  JSON.stringify(
    {
      version: 1,
      app: "canvas-vue-sql-lab",
      dialect,
      nodes,
      edges,
    },
    null,
    2
  );

export const parseGraphSnapshot = (raw) => {
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error("导入失败：快照内容缺少 nodes 或 edges 数组。");
  }
  return {
    dialect: parsed.dialect || "mysql",
    nodes: parsed.nodes,
    edges: parsed.edges,
  };
};
