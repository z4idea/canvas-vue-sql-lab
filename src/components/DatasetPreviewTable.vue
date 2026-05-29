<!-- @author: zhjj -->
<template>
  <section class="dataset-preview">
    <div class="section-title">
      <span>样本预览</span>
      <small>{{ dataset.payload.rows.length }} 行样例</small>
    </div>
    <div class="preview-meta">
      <strong>{{ dataset.label }}</strong>
      <span>{{ dataset.payload.schema }}.{{ dataset.payload.table }}</span>
    </div>
    <div class="preview-columns">
      <span v-for="column in dataset.payload.columns" :key="column.name" class="chip">
        {{ column.name }}
      </span>
    </div>
    <div class="preview-table-shell">
      <table class="preview-table">
        <thead>
          <tr>
            <th v-for="column in dataset.payload.columns" :key="column.name">{{ column.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in dataset.payload.rows.slice(0, 4)" :key="`${dataset.key}-${index}`">
            <td v-for="column in dataset.payload.columns" :key="column.name">{{ row[column.name] }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <button class="toolbar-button primary" @click="emit('quick-add', dataset.payload)">添加到画布</button>
  </section>
</template>

<script setup>
/**
 * @author: zhjj
 */
defineProps({
  dataset: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["quick-add"]);
</script>

<style scoped>
.dataset-preview {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(35, 77, 127, 0.14);
  background: rgba(220, 233, 247, 0.42);
}

.preview-meta {
  display: grid;
  gap: 4px;
}

.preview-meta span {
  color: var(--text-soft);
  font-size: 12px;
}

.preview-columns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preview-table-shell {
  overflow: auto;
  border-radius: 14px;
  border: 1px solid rgba(35, 77, 127, 0.12);
  background: rgba(255, 255, 255, 0.85);
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.preview-table th,
.preview-table td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid rgba(32, 49, 38, 0.08);
  white-space: nowrap;
}

.preview-table th {
  background: rgba(35, 77, 127, 0.08);
}
</style>
