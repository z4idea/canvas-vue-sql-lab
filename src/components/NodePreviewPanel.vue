<!-- @author: zhjj -->
<template>
  <section class="preview surface">
    <div class="preview-head">
      <div>
        <p class="eyebrow">Node Data Preview</p>
        <h2>{{ preview?.title || "节点预览" }}</h2>
      </div>
      <div v-if="preview" class="preview-chips">
        <span class="chip">样本 {{ preview.rowCount }} 行</span>
        <span class="chip">字段 {{ preview.columns.length }} 列</span>
      </div>
    </div>

    <div v-if="error" class="error-box">
      {{ error }}
    </div>

    <div v-else-if="!preview" class="empty-hint">
      右键节点后选择“预览数据”，这里会展示从上游链路计算到当前节点为止的样本结果。
    </div>

    <template v-else>
      <div class="surface-sub summary-card">
        <span>当前链路</span>
        <strong>{{ preview.lineageText }}</strong>
      </div>

      <div v-if="preview.outputTable" class="surface-sub summary-card">
        <span>输出表</span>
        <strong>{{ preview.outputTable }}</strong>
      </div>

      <div class="table-shell">
        <table class="preview-table">
          <thead>
            <tr>
              <th v-for="column in preview.columns" :key="column.name">{{ column.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="preview.previewRows.length === 0">
              <td :colspan="preview.columns.length || 1" class="empty-cell">当前链路没有可预览样本。</td>
            </tr>
            <tr v-for="(row, index) in preview.previewRows" :key="`${preview.nodeId}-${index}`">
              <td v-for="column in preview.columns" :key="column.name">{{ formatCell(row[column.name]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<script setup>
/**
 * @author: zhjj
 */
defineProps({
  preview: {
    type: Object,
    default: null,
  },
  error: {
    type: String,
    default: "",
  },
});

const formatCell = (value) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
};
</script>

<style scoped>
.preview {
  display: grid;
  gap: 16px;
  padding: 20px 18px 18px;
  border-radius: 28px;
}

.preview-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.preview-head h2 {
  margin: 6px 0 0;
  font-family: var(--font-title);
  font-size: 24px;
}

.preview-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.summary-card {
  display: grid;
  gap: 4px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
}

.summary-card span {
  color: var(--text-soft);
  font-size: 12px;
}

.table-shell {
  overflow: auto;
  border-radius: 18px;
  border: 1px solid rgba(32, 49, 38, 0.08);
  background: rgba(255, 255, 255, 0.82);
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.preview-table th,
.preview-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid rgba(32, 49, 38, 0.08);
  white-space: nowrap;
}

.preview-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgba(235, 243, 237, 0.96);
}

.empty-cell {
  text-align: center;
  color: var(--text-soft);
}

.error-box {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(180, 73, 54, 0.16);
  background: rgba(180, 73, 54, 0.08);
  color: var(--danger);
  line-height: 1.6;
}

.surface-sub {
  border: 1px solid rgba(32, 49, 38, 0.08);
}

@media (max-width: 900px) {
  .preview-head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
