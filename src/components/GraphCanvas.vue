<!-- @author: zhjj -->
<template>
  <section class="canvas-shell surface">
    <div class="canvas-toolbar">
      <div class="toolbar-left">
        <span class="chip">节点 {{ nodes.length }}</span>
        <span class="chip">连线 {{ edges.length }}</span>
        <span class="chip">视角 {{ Math.round(viewport.x) }}, {{ Math.round(viewport.y) }}</span>
        <span v-if="pendingConnection" class="chip pending-chip">
          正在连线：{{ pendingConnection.sourceTitle }}
        </span>
      </div>
      <div class="canvas-toolbar-note">按住空白处拖动画布，拖拽节点只移动节点。右键节点可操作，双击直接进入配置。</div>
    </div>

    <div
      ref="canvasRef"
      class="canvas-board"
      :class="{ panning: isPanning }"
      @dragover.prevent
      @drop="onDrop"
      @pointerdown="onBoardPointerDown"
      @pointermove="onCanvasPointerMove"
      @click="emit('canvas-click')"
    >
      <div class="canvas-grid" :style="gridStyle"></div>

      <div class="stage" :style="stageStyle">
        <svg class="edges-layer" :style="stageSizeStyle">
          <g v-for="edge in edgePaths" :key="edge.id">
            <path
              :d="edge.d"
              class="edge-hitbox"
              @click.stop="emit('select-edge', edge.id)"
              @contextmenu.prevent.stop="openEdgeContextMenu(edge.id, $event)"
            />
            <path
              :d="edge.d"
              class="edge-path"
              :class="{ selected: edge.id === selectedEdgeId, focused: edge.id === contextMenuEdgeId }"
            />
          </g>
          <path
            v-if="pendingPath"
            :d="pendingPath"
            class="edge-path pending-path"
          />
        </svg>

        <article
          v-for="node in nodes"
          :key="node.id"
          class="node-card"
          :class="[node.kind, { selected: node.id === selectedNodeId, focused: node.id === contextMenuNodeId }]"
          :style="{ left: `${node.x}px`, top: `${node.y}px`, width: `${node.width}px`, height: `${node.height}px` }"
          @click.stop="emit('select-node', node.id)"
          @dblclick.stop="emit('open-config', node.id)"
          @contextmenu.prevent.stop="openNodeContextMenu(node.id, $event)"
          @pointerdown.stop="startMove(node.id, $event)"
        >
          <button
            v-for="port in getPorts(node)"
            :key="port.key"
            class="port"
            :class="port.className"
            :style="port.style"
            :title="port.title"
            @click.stop="onPortClick(node, port)"
          ></button>

          <div class="node-head">
            <div class="node-accent"></div>
            <div class="node-text" @click.stop="emit('select-node', node.id)">
              <div class="node-title">{{ node.title }}</div>
              <div class="node-subtitle">{{ node.subtitle }}</div>
            </div>
          </div>
          <div class="node-meta">
            <span>{{ node.kind === "dataset" ? "数据集" : node.category }}</span>
            <span>{{ getSummary(node) }}</span>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup>
/**
 * @author: zhjj
 */
import { computed, ref } from "vue";
import { operatorMap } from "../core/catalog/operators";

const STAGE_WIDTH = 2800;
const STAGE_HEIGHT = 1800;
const GRID_SIZE = 24;

const props = defineProps({
  nodes: {
    type: Array,
    required: true,
  },
  edges: {
    type: Array,
    required: true,
  },
  selectedNodeId: {
    type: String,
    default: "",
  },
  selectedEdgeId: {
    type: String,
    default: "",
  },
  pendingConnection: {
    type: Object,
    default: null,
  },
  viewport: {
    type: Object,
    default: () => ({ x: 0, y: 0 }),
  },
  contextMenuNodeId: {
    type: String,
    default: "",
  },
  contextMenuEdgeId: {
    type: String,
    default: "",
  },
});

const emit = defineEmits([
  "drop-node",
  "select-node",
  "select-edge",
  "open-config",
  "node-contextmenu",
  "edge-contextmenu",
  "move-node",
  "move-viewport",
  "start-link",
  "complete-link",
  "canvas-click",
]);

const canvasRef = ref(null);
const pointerPosition = ref({ x: 0, y: 0 });
const isPanning = ref(false);

const nodeMap = computed(() => Object.fromEntries(props.nodes.map((node) => [node.id, node])));

const stageStyle = computed(() => ({
  width: `${STAGE_WIDTH}px`,
  height: `${STAGE_HEIGHT}px`,
  transform: `translate(${props.viewport.x}px, ${props.viewport.y}px)`,
}));

const stageSizeStyle = computed(() => ({
  width: `${STAGE_WIDTH}px`,
  height: `${STAGE_HEIGHT}px`,
}));

const gridStyle = computed(() => ({
  backgroundPosition: `${props.viewport.x % GRID_SIZE}px ${props.viewport.y % GRID_SIZE}px`,
  backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
}));

const getPorts = (node) => {
  if (node.kind === "dataset") {
    return [
      {
        key: "out",
        handle: "out",
        role: "output",
        title: "输出端口",
        className: "port-out",
        style: { left: "50%", top: "100%" },
      },
    ];
  }
  if (node.category === "bgl_" || node.category === "bbj_") {
    return [
      {
        key: "left",
        handle: "left",
        role: "input",
        title: "左输入",
        className: "port-in",
        style: { left: "26%", top: "0%" },
      },
      {
        key: "right",
        handle: "right",
        role: "input",
        title: "右输入",
        className: "port-in",
        style: { left: "74%", top: "0%" },
      },
      {
        key: "out",
        handle: "out",
        role: "output",
        title: "输出端口",
        className: "port-out",
        style: { left: "50%", top: "100%" },
      },
    ];
  }
  if (node.category === "bsc_") {
    return [
      {
        key: "in",
        handle: "in",
        role: "input",
        title: "输入端口",
        className: "port-in",
        style: { left: "50%", top: "0%" },
      },
    ];
  }
  return [
    {
      key: "in",
      handle: "in",
      role: "input",
      title: "输入端口",
      className: "port-in",
      style: { left: "50%", top: "0%" },
    },
    {
      key: "out",
      handle: "out",
      role: "output",
      title: "输出端口",
      className: "port-out",
      style: { left: "50%", top: "100%" },
    },
  ];
};

const portCenter = (node, handle) => {
  const port = getPorts(node).find((item) => item.handle === handle);
  if (!port) {
    return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
  }
  const xRatio = Number.parseFloat(String(port.style.left)) / 100;
  const yRatio = Number.parseFloat(String(port.style.top)) / 100;
  return {
    x: node.x + node.width * xRatio,
    y: node.y + node.height * yRatio,
  };
};

const edgePaths = computed(() =>
  props.edges
    .map((edge) => {
      const source = nodeMap.value[edge.sourceId];
      const target = nodeMap.value[edge.targetId];
      if (!source || !target) {
        return null;
      }
      const start = portCenter(source, edge.sourceHandle || "out");
      const end = portCenter(target, edge.targetHandle || "in");
      const dx = Math.max(120, Math.abs(end.x - start.x) * 0.4);
      return {
        id: edge.id,
        d: `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`,
      };
    })
    .filter(Boolean)
);

const pendingPath = computed(() => {
  if (!props.pendingConnection) {
    return "";
  }
  const source = nodeMap.value[props.pendingConnection.sourceId];
  if (!source) {
    return "";
  }
  const start = portCenter(source, props.pendingConnection.sourceHandle || "out");
  const end = pointerPosition.value;
  const dx = Math.max(120, Math.abs(end.x - start.x) * 0.4);
  return `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`;
});

const clampViewport = (x, y) => ({
  x: Math.min(420, Math.max(-STAGE_WIDTH + 320, x)),
  y: Math.min(220, Math.max(-STAGE_HEIGHT + 240, y)),
});

const boardPointToStagePoint = (clientX, clientY) => {
  const rect = canvasRef.value.getBoundingClientRect();
  return {
    x: clientX - rect.left - props.viewport.x,
    y: clientY - rect.top - props.viewport.y,
  };
};

const onDrop = (event) => {
  const raw = event.dataTransfer.getData("application/x-canvas-node");
  if (!raw) {
    return;
  }
  const payload = JSON.parse(raw);
  const point = boardPointToStagePoint(event.clientX, event.clientY);
  emit("drop-node", {
    ...payload,
    x: Math.max(24, point.x - 110),
    y: Math.max(24, point.y - 40),
  });
};

const onCanvasPointerMove = (event) => {
  pointerPosition.value = boardPointToStagePoint(event.clientX, event.clientY);
};

const onBoardPointerDown = (event) => {
  const target = event.target;
  const isStageTarget =
    target === canvasRef.value ||
    target.classList?.contains("stage") ||
    target.classList?.contains("edges-layer");
  if (event.button !== 0 || !isStageTarget) {
    return;
  }
  isPanning.value = true;
  const startX = event.clientX;
  const startY = event.clientY;
  const origin = { ...props.viewport };

  const onMove = (moveEvent) => {
    const next = clampViewport(origin.x + moveEvent.clientX - startX, origin.y + moveEvent.clientY - startY);
    emit("move-viewport", next);
  };

  const onUp = () => {
    isPanning.value = false;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
};

const getSummary = (node) => {
  if (node.kind === "dataset") {
    return `${node.data.columns.length} 列`;
  }
  if (node.category === "hgl_") {
    return `${(node.data.conditions || []).length} 条条件`;
  }
  if (node.category === "bfz_") {
    return `${(node.data.groupBys || []).length} 分组 / ${(node.data.aggregates || []).length} 聚合`;
  }
  if (node.category === "bgl_") {
    return `${node.data.joinType || "inner join"}`;
  }
  if (node.category === "bsc_") {
    return node.data.outputTable || "输出结果";
  }
  return operatorMap[node.category]?.label || "算子";
};

const onPortClick = (node, port) => {
  if (port.role === "output") {
    emit("start-link", {
      sourceId: node.id,
      sourceHandle: port.handle,
      sourceTitle: node.title,
    });
    return;
  }
  emit("complete-link", {
    targetId: node.id,
    targetHandle: port.handle,
  });
};

const openNodeContextMenu = (nodeId, event) => {
  emit("select-node", nodeId);
  emit("node-contextmenu", {
    nodeId,
    clientX: event.clientX,
    clientY: event.clientY,
  });
};

const openEdgeContextMenu = (edgeId, event) => {
  emit("select-edge", edgeId);
  emit("edge-contextmenu", {
    edgeId,
    clientX: event.clientX,
    clientY: event.clientY,
  });
};

const startMove = (nodeId, event) => {
  if (event.button !== 0) {
    return;
  }
  const node = nodeMap.value[nodeId];
  if (!node) {
    return;
  }
  emit("select-node", nodeId);
  const stagePoint = boardPointToStagePoint(event.clientX, event.clientY);
  const offsetX = stagePoint.x - node.x;
  const offsetY = stagePoint.y - node.y;

  const onMove = (moveEvent) => {
    const point = boardPointToStagePoint(moveEvent.clientX, moveEvent.clientY);
    emit("move-node", {
      nodeId,
      x: Math.max(12, Math.min(STAGE_WIDTH - node.width - 12, point.x - offsetX)),
      y: Math.max(12, Math.min(STAGE_HEIGHT - node.height - 12, point.y - offsetY)),
    });
  };

  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
};
</script>

<style scoped>
.canvas-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  border-radius: 24px;
  min-height: 0;
}

.canvas-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(32, 49, 38, 0.1);
}

.toolbar-left {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.canvas-toolbar-note {
  color: var(--text-soft);
  font-size: 12px;
}

.pending-chip {
  background: rgba(180, 73, 54, 0.08);
  color: var(--danger);
}

.canvas-board {
  position: relative;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
  background: rgba(255, 255, 255, 0.78);
}

.canvas-board.panning {
  cursor: grabbing;
}

.canvas-grid {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 1px 1px, rgba(32, 79, 59, 0.18) 1.1px, transparent 0);
  pointer-events: none;
}

.stage {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: top left;
}

.edges-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.edge-hitbox {
  fill: none;
  stroke: transparent;
  stroke-width: 18;
  pointer-events: stroke;
  cursor: pointer;
}

.edge-path {
  fill: none;
  stroke: rgba(22, 72, 55, 0.56);
  stroke-width: 3;
  stroke-linecap: round;
  pointer-events: none;
}

.edge-path.selected {
  stroke: rgba(22, 72, 55, 0.94);
  stroke-width: 4;
}

.edge-path.focused {
  stroke: rgba(245, 172, 69, 0.96);
  stroke-width: 4;
}

.pending-path {
  stroke: rgba(180, 73, 54, 0.72);
  stroke-dasharray: 10 8;
}

.node-card {
  position: absolute;
  border-radius: 18px;
  border: 1px solid rgba(32, 49, 38, 0.12);
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 14px 28px rgba(28, 49, 38, 0.1);
  user-select: none;
  cursor: move;
}

.node-card.selected {
  box-shadow: 0 0 0 3px rgba(32, 79, 59, 0.16), 0 14px 28px rgba(28, 49, 38, 0.12);
}

.node-card.focused {
  outline: 2px dashed rgba(245, 172, 69, 0.92);
  outline-offset: 4px;
}

.node-card.dataset .node-accent {
  background: var(--dataset);
}

.node-card.operator .node-accent {
  background: var(--operator);
}

.node-head {
  height: 50px;
  display: flex;
  align-items: stretch;
}

.node-accent {
  width: 32px;
  border-radius: 18px 0 0 0;
}

.node-text {
  flex: 1;
  padding: 10px 12px;
}

.node-title {
  font-weight: 700;
  font-size: 18px;
}

.node-subtitle {
  margin-top: 2px;
  color: var(--text-soft);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px 12px;
  border-top: 1px solid rgba(32, 49, 38, 0.08);
  color: var(--text-soft);
  font-size: 12px;
}

.port {
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 3px solid white;
  transform: translate(-50%, -50%);
  box-shadow: 0 6px 12px rgba(16, 39, 28, 0.16);
}

.port-in {
  background: #aad4bf;
}

.port-out {
  background: #2f8b68;
}

@media (max-width: 1380px) {
  .canvas-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
