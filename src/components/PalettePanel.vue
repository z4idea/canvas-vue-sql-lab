<!-- @author: zhjj -->
<template>
  <aside class="palette surface">
    <div class="palette-head">
      <div>
        <p class="eyebrow">Canvas SQL Lab</p>
        <h1>画布编排台</h1>
      </div>
      <span class="chip">拖拽到中间画布</span>
    </div>

    <section class="palette-section">
      <div class="section-title">
        <span>数据集</span>
        <small>拖拽或点击后拖入</small>
      </div>
      <div v-for="schema in datasets" :key="schema.key" class="tree-group">
        <div class="tree-group-title">{{ schema.label }}</div>
        <div
          v-for="datasetNode in schema.children"
          :key="datasetNode.key"
          class="palette-row dataset-card"
          :class="{ 'is-active': datasetNode.key === activeDatasetKey }"
          draggable="true"
          @click="activeDatasetKey = datasetNode.key"
          @dragstart="onDragStart(datasetNode.payload, 'dataset', $event)"
        >
          <div class="palette-row-copy">
            <div class="palette-card-title">{{ datasetNode.label }}</div>
            <div class="palette-card-meta">{{ datasetNode.payload.schema }}.{{ datasetNode.payload.table }}</div>
          </div>
          <span class="row-badge">{{ datasetNode.payload.columns.length }} 列</span>
        </div>
      </div>
      <div v-if="activeDataset" class="quick-add-panel">
        <div class="quick-add-copy">
          <strong>{{ activeDataset.label }}</strong>
          <span>{{ activeDataset.payload.description }}</span>
        </div>
        <button class="toolbar-button primary" @click="emit('quick-add-node', activeDataset.payload)">添加到画布</button>
      </div>
    </section>

    <section class="palette-section">
      <div class="section-title">
        <span>算子目录</span>
        <small>紧凑罗列</small>
      </div>
      <div v-for="group in operatorGroups" :key="group.key" class="tree-group">
        <div class="tree-group-title">{{ group.label }}</div>
        <div
          v-for="operator in group.items"
          :key="operator.category"
          class="palette-row operator-card"
          draggable="true"
          @dragstart="onDragStart(operator, 'operator', $event)"
        >
          <div class="palette-row-copy">
            <div class="palette-card-title">{{ operator.label }}</div>
            <div class="palette-card-meta">{{ operator.description }}</div>
          </div>
          <span class="row-badge row-badge-operator">{{ operator.category }}</span>
        </div>
      </div>
    </section>
  </aside>
</template>

<script setup>
/**
 * @author: zhjj
 */
import { computed, ref } from "vue";

const props = defineProps({
  datasets: {
    type: Array,
    required: true,
  },
  operatorGroups: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(["dragstart", "quick-add-node"]);

const activeDatasetKey = ref(props.datasets[0]?.children[0]?.key || "");

const flatDatasets = computed(() => props.datasets.flatMap((schema) => schema.children));
const activeDataset = computed(
  () => flatDatasets.value.find((datasetNode) => datasetNode.key === activeDatasetKey.value) || flatDatasets.value[0] || null
);

const onDragStart = (payload, kind, event) => {
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData(
    "application/x-canvas-node",
    JSON.stringify({
      kind,
      payload,
    })
  );
  emit("dragstart", { kind, payload });
};
</script>

<style scoped>
.palette {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 14px;
  border-radius: 24px;
  height: 100%;
  min-height: 0;
  overflow: auto;
}

.palette-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.palette-head h1 {
  margin: 4px 0 0;
  font-family: var(--font-title);
  font-size: clamp(18px, 1.4vw, 24px);
}

.eyebrow {
  margin: 0;
  color: var(--text-soft);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 11px;
}

.palette-section {
  display: grid;
  gap: 10px;
}

.section-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-weight: 700;
}

.section-title small {
  color: var(--text-soft);
  font-weight: 400;
}

.tree-group {
  display: grid;
  gap: 6px;
}

.tree-group-title {
  color: var(--text-soft);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.palette-row {
  border: 1px solid rgba(32, 49, 38, 0.1);
  border-radius: 14px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.78);
  transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.palette-row:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 26px rgba(32, 49, 38, 0.08);
}

.palette-row.is-active {
  box-shadow: 0 0 0 2px rgba(35, 77, 127, 0.16);
}

.dataset-card {
  border-color: rgba(35, 77, 127, 0.16);
}

.operator-card {
  border-color: rgba(30, 105, 86, 0.16);
}

.palette-card-title {
  font-weight: 700;
  line-height: 1.25;
}

.palette-card-meta {
  color: var(--text-soft);
  font-size: 12px;
  margin-top: 2px;
}

.palette-row-copy {
  min-width: 0;
  flex: 1;
}

.row-badge {
  flex: 0 0 auto;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(35, 77, 127, 0.1);
  color: var(--dataset);
  font-size: 11px;
  white-space: nowrap;
}

.row-badge-operator {
  background: rgba(30, 105, 86, 0.1);
  color: var(--operator);
}

.quick-add-panel {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  border: 1px dashed rgba(32, 79, 59, 0.16);
  background: rgba(255, 255, 255, 0.58);
}

.quick-add-copy {
  display: grid;
  gap: 4px;
}

.quick-add-copy span {
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.45;
}

@media (max-width: 1380px) {
  .palette {
    padding: 14px 12px;
  }
}
</style>
