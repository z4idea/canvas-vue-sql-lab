<!-- @author: zhjj -->
<template>
  <section class="snapshot surface" :class="{ compact, expanded }">
    <div class="snapshot-head">
      <div>
        <p class="eyebrow">Canvas Snapshot</p>
        <h2>画布 JSON</h2>
      </div>
      <div class="snapshot-actions">
        <button class="toolbar-button" @click="emit('refresh-export')">刷新导出</button>
        <button class="toolbar-button primary" @click="emit('copy-export')">复制 JSON</button>
        <button class="toolbar-button" @click="emit('import-graph', localValue)">导入到画布</button>
      </div>
    </div>

    <div class="empty-hint">
      这里保存的是当前节点图快照，不依赖后端。可以直接导出、修改后再导回，便于演示“画布结构”和“SQL 编译结果”的对应关系。
    </div>

    <div class="field-row">
      <label>画布快照</label>
      <textarea v-model="localValue" spellcheck="false"></textarea>
    </div>
  </section>
</template>

<script setup>
/**
 * @author: zhjj
 */
import { ref, watch } from "vue";

const props = defineProps({
  value: {
    type: String,
    default: "",
  },
  compact: {
    type: Boolean,
    default: false,
  },
  expanded: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["refresh-export", "copy-export", "import-graph"]);

const localValue = ref(props.value);

watch(
  () => props.value,
  (value) => {
    localValue.value = value;
  },
  { immediate: true }
);
</script>

<style scoped>
.snapshot {
  display: grid;
  gap: 16px;
  padding: 20px 18px;
  border-radius: 28px;
}

.snapshot.compact {
  padding: 8px 4px 4px;
  border-radius: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.snapshot-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.snapshot-head h2 {
  margin: 6px 0 0;
  font-family: var(--font-title);
  font-size: 24px;
}

.snapshot-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.field-row textarea {
  min-height: 180px;
  font-family: "Cascadia Code", "Consolas", monospace;
  font-size: 12px;
  line-height: 1.6;
  resize: none;
}

.snapshot.expanded {
  gap: 18px;
  padding: 18px 20px 20px;
}

.snapshot.expanded .field-row {
  display: grid;
  gap: 10px;
  min-height: 0;
}

.snapshot.expanded .field-row textarea {
  min-height: min(58dvh, 620px);
  font-size: 13px;
}

@media (max-width: 900px) {
  .snapshot-head {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
