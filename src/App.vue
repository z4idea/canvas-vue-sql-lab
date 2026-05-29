<!-- @author: zhjj -->
<template>
  <div class="app-shell">
    <header class="topbar surface">
      <div class="topbar-copy">
        <p class="eyebrow">Vue Remake</p>
        <h1>画布编排与 SQL 编译实验台</h1>
        <p>左侧拖入数据集和算子，中间排布节点。右键删除或配置，双击直接编辑。</p>
      </div>
      <div class="topbar-actions">
        <select v-model="dialect" class="toolbar-button">
          <option value="mysql">mysql</option>
          <option value="postgresql">postgresql</option>
          <option value="sqlserver">sqlserver</option>
          <option value="oracle">oracle</option>
        </select>
        <button class="toolbar-button" @click="loadDemoFlow">加载演示链路</button>
        <button class="toolbar-button" @click="resetViewport">重置视角</button>
        <button class="toolbar-button" @click="resetGraph">清空画布</button>
        <button class="toolbar-button" @click="previewModalOpen = true">SQL 预览</button>
        <button class="toolbar-button" @click="snapshotModalOpen = true">画布快照</button>
        <button class="toolbar-button primary" @click="copySql">复制 SQL</button>
      </div>
    </header>

    <main class="workspace">
      <aside class="catalog-panel surface">
        <PalettePanel
          :datasets="datasetTree"
          :operator-groups="sqlOperatorGroups"
          @quick-add-node="quickAddDataset"
        />
      </aside>

      <section class="editor-shell">
        <GraphCanvas
          class="editor-canvas"
          :nodes="nodes"
          :edges="edges"
          :selected-node-id="selectedNodeId"
          :selected-edge-id="selectedEdgeId"
          :pending-connection="pendingConnection"
          :viewport="viewport"
          :context-menu-node-id="contextMenu.targetType === 'node' ? contextMenu.targetId : ''"
          :context-menu-edge-id="contextMenu.targetType === 'edge' ? contextMenu.targetId : ''"
          @drop-node="handleDropNode"
          @select-node="handleSelectNode"
          @select-edge="handleSelectEdge"
          @open-config="openConfigForNode"
          @node-contextmenu="openContextMenu"
          @edge-contextmenu="openEdgeContextMenu"
          @move-node="moveNode"
          @move-viewport="moveViewport"
          @start-link="startLink"
          @complete-link="completeLink"
          @canvas-click="handleCanvasClick"
        />
      </section>
    </main>

    <teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="context-menu"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      >
        <button
          v-if="contextMenu.targetType === 'node'"
          class="context-action"
          @click="handleContextPreview"
        >
          预览数据
        </button>
        <button
          v-if="contextMenu.targetType === 'node'"
          class="context-action"
          @click="handleContextConfig"
        >
          进入配置
        </button>
        <button class="context-action danger" @click="handleContextDelete">
          {{ contextMenu.targetType === "edge" ? "删除连线" : "删除节点" }}
        </button>
      </div>
    </teleport>

    <teleport to="body">
      <div v-if="configModalOpen" class="modal-backdrop" @click.self="closeConfigModal">
        <section class="config-modal surface">
          <div class="config-modal-head">
            <div>
              <p class="eyebrow">Node Config</p>
              <h2>{{ selectedNode?.title || "节点配置" }}</h2>
            </div>
            <button class="toolbar-button danger" @click="closeConfigModal">关闭</button>
          </div>
          <ConfigPanel
            modal
            :selected-node="selectedNode"
            :upstream="availableColumns"
            :current-columns="selectedNodeColumns"
            @update-node="applyNodeUpdateFromModal"
          />
        </section>
      </div>
    </teleport>

    <teleport to="body">
      <div v-if="previewModalOpen" class="modal-backdrop" @click.self="previewModalOpen = false">
        <section class="preview-modal surface">
          <div class="config-modal-head">
            <div>
              <p class="eyebrow">Front-end Compiler</p>
              <h2>SQL 预览</h2>
            </div>
            <button class="toolbar-button danger" @click="previewModalOpen = false">关闭</button>
          </div>
          <div class="preview-modal-body">
            <SqlPreviewPanel :result="compiledResult" :error="compileError" :dialect="dialect" />
          </div>
        </section>
      </div>
    </teleport>

    <teleport to="body">
      <div v-if="dataPreviewModalOpen" class="modal-backdrop" @click.self="closeDataPreviewModal">
        <section class="preview-modal data-preview-modal surface">
          <div class="config-modal-head">
            <div>
              <p class="eyebrow">Node Data Preview</p>
              <h2>节点样本预览</h2>
            </div>
            <button class="toolbar-button danger" @click="closeDataPreviewModal">关闭</button>
          </div>
          <div class="preview-modal-body">
            <NodePreviewPanel :preview="dataPreviewResult" :error="dataPreviewError" />
          </div>
        </section>
      </div>
    </teleport>

    <teleport to="body">
      <div v-if="snapshotModalOpen" class="modal-backdrop">
        <section class="preview-modal snapshot-modal surface">
          <div class="config-modal-head">
            <div>
              <p class="eyebrow">Graph Snapshot</p>
              <h2>画布快照</h2>
            </div>
            <button class="toolbar-button danger" @click="snapshotModalOpen = false">关闭</button>
          </div>
          <div class="preview-modal-body">
            <GraphSnapshotPanel
              :value="snapshotText"
              expanded
              @refresh-export="refreshSnapshot"
              @copy-export="copySnapshot"
              @import-graph="importSnapshot"
            />
          </div>
        </section>
      </div>
    </teleport>
  </div>
</template>

<script setup>
/**
 * @author: zhjj
 */
import { computed, onMounted, ref, watch } from "vue";
import ConfigPanel from "./components/ConfigPanel.vue";
import GraphCanvas from "./components/GraphCanvas.vue";
import GraphSnapshotPanel from "./components/GraphSnapshotPanel.vue";
import NodePreviewPanel from "./components/NodePreviewPanel.vue";
import PalettePanel from "./components/PalettePanel.vue";
import SqlPreviewPanel from "./components/SqlPreviewPanel.vue";
import { datasetTree, getDatasetById } from "./core/catalog/datasets";
import { sqlOperatorGroups } from "./core/catalog/operators";
import { createDatasetNode, createEdge, createOperatorNode } from "./core/graph/nodeFactory";
import {
  canAcceptConnection,
  exportGraphSnapshot,
  parseGraphSnapshot,
  pickFirstOutputNode,
  removeNodeWithEdges,
} from "./core/graph/graphUtils";
import { analyzeAvailableColumns, compileGraph, compileNode } from "./core/sql/compiler";
import { previewNodeData } from "./core/sql/previewData";

const nodes = ref([]);
const edges = ref([]);
const selectedNodeId = ref("");
const selectedEdgeId = ref("");
const pendingConnection = ref(null);
const dialect = ref("mysql");
const compiledResult = ref(null);
const compileError = ref("");
const snapshotText = ref("");
const viewport = ref({ x: 320, y: 120 });
const configModalOpen = ref(false);
const previewModalOpen = ref(false);
const snapshotModalOpen = ref(false);
const dataPreviewModalOpen = ref(false);
const dataPreviewNodeId = ref("");
const dataPreviewResult = ref(null);
const dataPreviewError = ref("");
const contextMenu = ref({
  visible: false,
  targetType: "",
  targetId: "",
  x: 0,
  y: 0,
});

const selectedNode = computed(() => nodes.value.find((node) => node.id === selectedNodeId.value) || null);

const availableColumns = computed(() => {
  if (!selectedNode.value) {
    return { primary: [], left: [], right: [] };
  }
  try {
    return analyzeAvailableColumns({ nodes: nodes.value, edges: edges.value }, selectedNode.value.id, {
      dialect: dialect.value,
    });
  } catch {
    return { primary: [], left: [], right: [] };
  }
});

const selectedNodeColumns = computed(() => {
  if (!selectedNode.value) {
    return [];
  }
  try {
    return compileNode({ nodes: nodes.value, edges: edges.value }, selectedNode.value.id, {
      dialect: dialect.value,
    }).columns;
  } catch {
    return [];
  }
});

const compileActiveGraph = () => {
  const outputNode =
    (selectedNode.value && selectedNode.value.category === "bsc_" ? selectedNode.value : null) ||
    pickFirstOutputNode(nodes.value);
  if (!outputNode) {
    compiledResult.value = null;
    compileError.value = "";
    return;
  }
  try {
    compiledResult.value = compileGraph(
      {
        nodes: nodes.value,
        edges: edges.value,
      },
      outputNode.id,
      { dialect: dialect.value }
    );
    compileError.value = "";
  } catch (error) {
    compiledResult.value = null;
    compileError.value = error instanceof Error ? error.message : String(error);
  }
};

watch([nodes, edges, dialect, selectedNodeId], compileActiveGraph, { deep: true });

watch(
  [nodes, edges, dialect, dataPreviewModalOpen, dataPreviewNodeId],
  () => {
    if (!dataPreviewModalOpen.value || !dataPreviewNodeId.value) {
      return;
    }
    try {
      dataPreviewResult.value = previewNodeData(
        {
          nodes: nodes.value,
          edges: edges.value,
        },
        dataPreviewNodeId.value,
        { dialect: dialect.value }
      );
      dataPreviewError.value = "";
    } catch (error) {
      dataPreviewResult.value = null;
      dataPreviewError.value = error instanceof Error ? error.message : String(error);
    }
  },
  { deep: true }
);

watch(
  [nodes, edges, dialect],
  () => {
    snapshotText.value = exportGraphSnapshot({
      nodes: nodes.value,
      edges: edges.value,
      dialect: dialect.value,
    });
  },
  { deep: true, immediate: true }
);

const closeContextMenu = () => {
  contextMenu.value = {
    visible: false,
    targetType: "",
    targetId: "",
    x: 0,
    y: 0,
  };
};

const handleDropNode = ({ kind, payload, x, y }) => {
  if (kind === "dataset") {
    nodes.value.push(createDatasetNode(payload, { x, y }));
  } else {
    nodes.value.push(createOperatorNode(payload.category, { x, y }));
  }
};

const handleSelectNode = (nodeId) => {
  selectedNodeId.value = nodeId;
  selectedEdgeId.value = "";
  closeContextMenu();
};

const handleSelectEdge = (edgeId) => {
  selectedEdgeId.value = edgeId;
  selectedNodeId.value = "";
  closeContextMenu();
};

const moveNode = ({ nodeId, x, y }) => {
  const target = nodes.value.find((node) => node.id === nodeId);
  if (!target) {
    return;
  }
  target.x = x;
  target.y = y;
};

const moveViewport = ({ x, y }) => {
  viewport.value = { x, y };
};

const quickAddDataset = (dataset) => {
  nodes.value.push(
    createDatasetNode(dataset, {
      x: 120 + nodes.value.length * 36,
      y: 160 + nodes.value.length * 24,
    })
  );
};

const startLink = (payload) => {
  pendingConnection.value = payload;
  compileError.value = "";
  closeContextMenu();
};

const completeLink = ({ targetId, targetHandle }) => {
  if (!pendingConnection.value) {
    return;
  }
  const validation = canAcceptConnection(
    nodes.value,
    edges.value,
    pendingConnection.value.sourceId,
    targetId,
    targetHandle
  );
  if (!validation.ok) {
    compileError.value = validation.message;
    pendingConnection.value = null;
    return;
  }
  edges.value.push(
    createEdge({
      sourceId: pendingConnection.value.sourceId,
      sourceHandle: pendingConnection.value.sourceHandle,
      targetId,
      targetHandle,
    })
  );
  pendingConnection.value = null;
};

const handleCanvasClick = () => {
  if (pendingConnection.value) {
    pendingConnection.value = null;
  }
  selectedEdgeId.value = "";
  closeContextMenu();
};

const openContextMenu = ({ nodeId, clientX, clientY }) => {
  selectedNodeId.value = nodeId;
  selectedEdgeId.value = "";
  contextMenu.value = {
    visible: true,
    targetType: "node",
    targetId: nodeId,
    x: clientX + 6,
    y: clientY + 6,
  };
};

const openEdgeContextMenu = ({ edgeId, clientX, clientY }) => {
  selectedEdgeId.value = edgeId;
  selectedNodeId.value = "";
  contextMenu.value = {
    visible: true,
    targetType: "edge",
    targetId: edgeId,
    x: clientX + 6,
    y: clientY + 6,
  };
};

const openConfigForNode = (nodeId) => {
  selectedNodeId.value = nodeId;
  configModalOpen.value = true;
  closeContextMenu();
};

const openDataPreviewForNode = (nodeId) => {
  dataPreviewNodeId.value = nodeId;
  dataPreviewModalOpen.value = true;
  try {
    dataPreviewResult.value = previewNodeData(
      {
        nodes: nodes.value,
        edges: edges.value,
      },
      nodeId,
      { dialect: dialect.value }
    );
    dataPreviewError.value = "";
  } catch (error) {
    dataPreviewResult.value = null;
    dataPreviewError.value = error instanceof Error ? error.message : String(error);
  }
  closeContextMenu();
};

const handleContextPreview = () => {
  if (contextMenu.value.targetType !== "node" || !contextMenu.value.targetId) {
    return;
  }
  openDataPreviewForNode(contextMenu.value.targetId);
};

const handleContextConfig = () => {
  if (contextMenu.value.targetType !== "node" || !contextMenu.value.targetId) {
    return;
  }
  openConfigForNode(contextMenu.value.targetId);
};

const handleContextDelete = () => {
  if (!contextMenu.value.targetId) {
    return;
  }
  if (contextMenu.value.targetType === "edge") {
    edges.value = edges.value.filter((edge) => edge.id !== contextMenu.value.targetId);
    if (selectedEdgeId.value === contextMenu.value.targetId) {
      selectedEdgeId.value = "";
    }
    closeContextMenu();
    return;
  }
  const next = removeNodeWithEdges(nodes.value, edges.value, contextMenu.value.targetId);
  nodes.value = next.nodes;
  edges.value = next.edges;
  if (selectedNodeId.value === contextMenu.value.targetId) {
    selectedNodeId.value = "";
  }
  if (dataPreviewNodeId.value === contextMenu.value.targetId) {
    dataPreviewModalOpen.value = false;
    dataPreviewNodeId.value = "";
    dataPreviewResult.value = null;
    dataPreviewError.value = "";
  }
  selectedEdgeId.value = "";
  closeContextMenu();
};

const closeConfigModal = () => {
  configModalOpen.value = false;
};

const closeDataPreviewModal = () => {
  dataPreviewModalOpen.value = false;
};

const applyNodeUpdateFromModal = (nextNode) => {
  const index = nodes.value.findIndex((node) => node.id === nextNode.id);
  if (index >= 0) {
    nodes.value.splice(index, 1, nextNode);
  }
  configModalOpen.value = false;
};

const resetViewport = () => {
  viewport.value = { x: 320, y: 120 };
};

const resetGraph = () => {
  nodes.value = [];
  edges.value = [];
  selectedNodeId.value = "";
  selectedEdgeId.value = "";
  pendingConnection.value = null;
  compileError.value = "";
  configModalOpen.value = false;
  previewModalOpen.value = false;
  dataPreviewModalOpen.value = false;
  dataPreviewNodeId.value = "";
  dataPreviewResult.value = null;
  dataPreviewError.value = "";
  snapshotModalOpen.value = false;
  closeContextMenu();
};

const loadDemoFlow = () => {
  resetGraph();
  const orderNode = createDatasetNode(getDatasetById("original.product_order"), { x: 160, y: 180 });
  const newColumnNode = createOperatorNode("newColumn_", { x: 520, y: 180 });
  newColumnNode.data.rules = [
    {
      id: "demo-newcol",
      alias: "month",
      label: "月份",
      expression: "substr(order_date, 1, 7)",
    },
  ];

  const groupNode = createOperatorNode("bfz_", { x: 900, y: 180 });
  groupNode.data.groupBys = ["product_id", "month"];
  groupNode.data.aggregates = [
    {
      id: "demo-agg-1",
      func: "sum",
      column: "order_quantity",
      alias: "total_quantity",
      label: "总销量",
      havingOperator: ">=",
      havingValue: "0",
    },
    {
      id: "demo-agg-2",
      func: "sum",
      column: "order_amount",
      alias: "total_amount",
      label: "总金额",
      havingOperator: ">=",
      havingValue: "0",
    },
  ];

  const productNode = createDatasetNode(getDatasetById("original.product_list"), { x: 900, y: 520 });
  const joinNode = createOperatorNode("bgl_", { x: 1320, y: 360 });
  joinNode.data.joinType = "inner join";
  joinNode.data.conditions = [
    {
      id: "demo-join-1",
      leftColumn: "product_id",
      operator: "equal",
      rightColumn: "product_id",
    },
  ];

  const outputNode = createOperatorNode("bsc_", { x: 1720, y: 360 });
  outputNode.data.outputTable = "self_owned.dws_tea_order";
  outputNode.data.selectedColumns = [
    "product_id",
    "month",
    "total_quantity",
    "total_amount",
    "type_name",
    "product_name",
  ];
  outputNode.data.aliases = {
    product_id: "product_id",
    month: "month",
    total_quantity: "total_quantity",
    total_amount: "total_amount",
    type_name: "type_name",
    product_name: "product_name",
  };

  nodes.value = [orderNode, newColumnNode, groupNode, productNode, joinNode, outputNode];
  edges.value = [
    createEdge({ sourceId: orderNode.id, sourceHandle: "out", targetId: newColumnNode.id, targetHandle: "in" }),
    createEdge({ sourceId: newColumnNode.id, sourceHandle: "out", targetId: groupNode.id, targetHandle: "in" }),
    createEdge({ sourceId: groupNode.id, sourceHandle: "out", targetId: joinNode.id, targetHandle: "left" }),
    createEdge({ sourceId: productNode.id, sourceHandle: "out", targetId: joinNode.id, targetHandle: "right" }),
    createEdge({ sourceId: joinNode.id, sourceHandle: "out", targetId: outputNode.id, targetHandle: "in" }),
  ];
  selectedNodeId.value = outputNode.id;
  selectedEdgeId.value = "";
  viewport.value = { x: 180, y: 60 };
};

const copySql = async () => {
  if (!compiledResult.value?.sql) {
    return;
  }
  await navigator.clipboard.writeText(compiledResult.value.sql);
};

const refreshSnapshot = () => {
  snapshotText.value = exportGraphSnapshot({
    nodes: nodes.value,
    edges: edges.value,
    dialect: dialect.value,
  });
};

const copySnapshot = async () => {
  await navigator.clipboard.writeText(snapshotText.value);
};

const importSnapshot = (raw) => {
  try {
    const parsed = parseGraphSnapshot(raw);
    nodes.value = parsed.nodes;
    edges.value = parsed.edges;
    dialect.value = parsed.dialect;
    selectedNodeId.value = "";
    selectedEdgeId.value = "";
    dataPreviewNodeId.value = "";
    dataPreviewResult.value = null;
    dataPreviewError.value = "";
    dataPreviewModalOpen.value = false;
    pendingConnection.value = null;
    closeContextMenu();
    compileError.value = "";
  } catch (error) {
    compileError.value = error instanceof Error ? error.message : String(error);
  }
};

onMounted(() => {
  loadDemoFlow();
});
</script>

<style scoped>
.app-shell {
  height: 100dvh;
  padding: 16px 18px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  overflow: hidden;
}

.topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  border-radius: 22px;
  min-height: 0;
}

.topbar-copy {
  max-width: 760px;
}

.topbar-copy h1 {
  margin: 4px 0 8px;
  font-family: var(--font-title);
  font-size: clamp(24px, 2vw, 34px);
}

.topbar-copy p:last-child {
  margin: 0;
  color: var(--text-soft);
  line-height: 1.45;
  font-size: 14px;
}

.topbar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.workspace {
  display: grid;
  grid-template-columns: 308px minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
  overflow: hidden;
}

.catalog-panel {
  min-height: 0;
  overflow: hidden;
  border-radius: 22px;
}

.editor-shell {
  display: grid;
  min-height: 0;
  overflow: hidden;
}

.editor-canvas {
  min-height: 0;
  height: 100%;
}

:global(.context-menu) {
  position: fixed;
  z-index: 40;
  min-width: 156px;
  padding: 8px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(32, 49, 38, 0.12);
  box-shadow: 0 18px 32px rgba(23, 36, 28, 0.18);
  display: grid;
  gap: 6px;
}

:global(.context-action) {
  border: 0;
  text-align: left;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(32, 79, 59, 0.06);
  color: var(--text-main);
  font: inherit;
}

:global(.context-action:hover) {
  background: rgba(32, 79, 59, 0.12);
}

:global(.context-action.danger) {
  color: var(--danger);
  background: rgba(180, 73, 54, 0.08);
}

:global(.modal-backdrop) {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(16, 28, 22, 0.28);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  padding: 28px;
}

.config-modal {
  width: min(980px, calc(100vw - 56px));
  max-height: calc(100dvh - 56px);
  border-radius: 26px;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.preview-modal {
  width: min(1160px, calc(100vw - 56px));
  max-height: calc(100dvh - 56px);
  border-radius: 26px;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.snapshot-modal {
  width: min(1240px, calc(100vw - 40px));
  max-height: calc(100dvh - 40px);
}

.data-preview-modal {
  width: min(1320px, calc(100vw - 40px));
  max-height: calc(100dvh - 40px);
}

.preview-modal-body {
  min-height: 0;
  overflow: auto;
  padding: 0 8px 8px;
}

.config-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(32, 49, 38, 0.08);
}

.config-modal-head h2 {
  margin: 6px 0 0;
  font-family: var(--font-title);
  font-size: 28px;
}

@media (max-width: 1400px) {
  .workspace {
    grid-template-columns: 284px minmax(0, 1fr);
  }
}

@media (max-width: 1120px) {
  .app-shell {
    padding: 12px;
  }

  .workspace {
    grid-template-columns: 1fr;
  }

  .editor-shell {
    min-height: 0;
  }
}

@media (max-width: 860px) {
  .topbar {
    grid-template-columns: 1fr;
    display: grid;
  }

  .topbar-actions,
  .config-modal-head {
    align-items: stretch;
    flex-direction: column;
  }

  .config-modal {
    width: calc(100vw - 24px);
    max-height: calc(100dvh - 24px);
  }

  .preview-modal {
    width: calc(100vw - 24px);
    max-height: calc(100dvh - 24px);
  }

  .snapshot-modal {
    width: calc(100vw - 24px);
    max-height: calc(100dvh - 24px);
  }

  .data-preview-modal {
    width: calc(100vw - 24px);
    max-height: calc(100dvh - 24px);
  }
}
</style>
