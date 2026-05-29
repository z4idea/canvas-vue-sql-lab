<!-- @author: zhjj -->
<template>
  <aside class="config surface" :class="{ modal }">
    <div class="config-head">
      <div>
        <p class="eyebrow">Node Config</p>
        <h2>{{ draft?.title || "未选择节点" }}</h2>
      </div>
      <button class="toolbar-button primary" :disabled="!draft" @click="applyChanges">保存配置</button>
    </div>

    <div v-if="!draft" class="empty-hint">
      先在中间画布选中一个节点。左侧可以拖入数据集或算子，顶部端口用于连接上下游。
    </div>

    <template v-else>
      <div class="identity surface-sub">
        <div><strong>类别</strong><span>{{ draft.kind === "dataset" ? "数据集" : draft.category }}</span></div>
        <div><strong>标题</strong><span>{{ draft.title }}</span></div>
      </div>

      <section v-if="draft.kind === 'dataset'" class="config-section">
        <h3>数据集列选择</h3>
        <div class="checkbox-grid">
          <label v-for="column in draft.data.columns" :key="column.name">
            <input v-model="draft.data.selectedColumns" type="checkbox" :value="column.name" />
            <span>{{ column.label }} <em>{{ column.name }}</em></span>
          </label>
        </div>

        <div class="section-actions">
          <button class="toolbar-button" @click="addSourceExtraColumn">新增表达式列</button>
        </div>

        <div v-for="rule in draft.data.extraColumns" :key="rule.id" class="row-card">
          <div class="field-row">
            <label>列名</label>
            <input v-model="rule.alias" placeholder="例如 month_key" />
          </div>
          <div class="field-row">
            <label>显示名</label>
            <input v-model="rule.label" placeholder="例如 月份字段" />
          </div>
          <div class="field-row">
            <label>表达式</label>
            <textarea v-model="rule.expression" placeholder="例如 substr(order_date, 1, 7)"></textarea>
          </div>
          <button class="toolbar-button danger" @click="removeRow(draft.data.extraColumns, rule.id)">删除</button>
        </div>
      </section>

      <section v-else-if="draft.category === 'hgl_'" class="config-section">
        <h3>过滤条件</h3>
        <div class="field-row">
          <label>条件关系</label>
          <select v-model="draft.data.conditionLogic">
            <option value="and">and</option>
            <option value="or">or</option>
          </select>
        </div>
        <div v-for="condition in draft.data.conditions" :key="condition.id" class="row-card row-grid">
          <div class="field-row">
            <label>列</label>
            <select v-model="condition.column">
              <option value="">请选择</option>
              <option v-for="column in upstream.primary" :key="column.name" :value="column.name">{{ column.label }}</option>
            </select>
          </div>
          <div class="field-row">
            <label>操作符</label>
            <select v-model="condition.operator">
              <option value="equal">=</option>
              <option value="notEqual"><></option>
              <option value="greaterThan">></option>
              <option value="greaterThanEqual">>=</option>
              <option value="lessThan"><</option>
              <option value="lessThanEqual"><=</option>
              <option value="like">包含</option>
              <option value="beginsWith">开始于</option>
              <option value="endsWith">结束于</option>
              <option value="notLike">不包含</option>
              <option value="isNull">为空</option>
              <option value="isNotNull">非空</option>
            </select>
          </div>
          <div class="field-row">
            <label>值类型</label>
            <select v-model="condition.valueType">
              <option value="literal">字面量</option>
              <option value="expression">表达式</option>
            </select>
          </div>
          <div class="field-row row-span">
            <label>值</label>
            <input v-model="condition.value" placeholder="例如 2026-01 或 amount * 1.13" />
          </div>
          <button class="toolbar-button danger row-span" @click="removeRow(draft.data.conditions, condition.id)">删除</button>
        </div>
        <div class="section-actions">
          <button class="toolbar-button" @click="addFilterCondition">新增条件</button>
        </div>
        <div class="field-row">
          <label>附加 where 片段</label>
          <textarea v-model="draft.data.extraWhere" placeholder="例如 dept_id like '1001%'" />
        </div>
      </section>

      <section v-else-if="draft.category === 'newColumn_'" class="config-section">
        <h3>新增列表达式</h3>
        <div v-for="rule in draft.data.rules" :key="rule.id" class="row-card">
          <div class="field-row">
            <label>列名</label>
            <input v-model="rule.alias" />
          </div>
          <div class="field-row">
            <label>显示名</label>
            <input v-model="rule.label" />
          </div>
          <div class="field-row">
            <label>表达式</label>
            <textarea v-model="rule.expression" placeholder="例如 substr(order_date, 1, 7)" />
          </div>
          <button class="toolbar-button danger" @click="removeRow(draft.data.rules, rule.id)">删除</button>
        </div>
        <div class="section-actions">
          <button class="toolbar-button" @click="addNewColumnRule">新增表达式</button>
        </div>
      </section>

      <section v-else-if="draft.category === 'bfz_'" class="config-section">
        <h3>分组聚合</h3>
        <div class="field-row">
          <label>分组列</label>
          <div class="checkbox-grid">
            <label v-for="column in upstream.primary" :key="column.name">
              <input v-model="draft.data.groupBys" type="checkbox" :value="column.name" />
              <span>{{ column.label }}</span>
            </label>
          </div>
        </div>
        <div v-for="aggregate in draft.data.aggregates" :key="aggregate.id" class="row-card row-grid">
          <div class="field-row">
            <label>函数</label>
            <select v-model="aggregate.func">
              <option value="count">count</option>
              <option value="distinctCount">distinctCount</option>
              <option value="sum">sum</option>
              <option value="max">max</option>
              <option value="min">min</option>
              <option value="avg">avg</option>
            </select>
          </div>
          <div class="field-row">
            <label>列</label>
            <select v-model="aggregate.column">
              <option value="">请选择</option>
              <option v-for="column in upstream.primary" :key="column.name" :value="column.name">{{ column.label }}</option>
            </select>
          </div>
          <div class="field-row">
            <label>别名</label>
            <input v-model="aggregate.alias" />
          </div>
          <div class="field-row">
            <label>显示名</label>
            <input v-model="aggregate.label" />
          </div>
          <div class="field-row">
            <label>Having 运算符</label>
            <select v-model="aggregate.havingOperator">
              <option value="">无</option>
              <option value=">">></option>
              <option value=">=">>=</option>
              <option value="<"><</option>
              <option value="<="><=</option>
              <option value="=">=</option>
            </select>
          </div>
          <div class="field-row">
            <label>Having 值</label>
            <input v-model="aggregate.havingValue" />
          </div>
          <button class="toolbar-button danger row-span" @click="removeRow(draft.data.aggregates, aggregate.id)">删除</button>
        </div>
        <div class="section-actions">
          <button class="toolbar-button" @click="addAggregateRule">新增聚合</button>
        </div>
      </section>

      <section v-else-if="draft.category === 'hzl_'" class="config-section">
        <h3>行转列汇总</h3>
        <div class="field-row">
          <label>分组列</label>
          <div class="checkbox-grid">
            <label v-for="column in upstream.primary" :key="column.name">
              <input v-model="draft.data.groupBys" type="checkbox" :value="column.name" />
              <span>{{ column.label }}</span>
            </label>
          </div>
        </div>
        <div v-for="rule in draft.data.pivotColumns" :key="rule.id" class="row-card row-grid">
          <div class="field-row">
            <label>源列</label>
            <select v-model="rule.sourceColumn">
              <option value="">请选择</option>
              <option v-for="column in upstream.primary" :key="column.name" :value="column.name">{{ column.label }}</option>
            </select>
          </div>
          <div class="field-row">
            <label>排序列</label>
            <select v-model="rule.orderColumn">
              <option value="">请选择</option>
              <option v-for="column in upstream.primary" :key="column.name" :value="column.name">{{ column.label }}</option>
            </select>
          </div>
          <div class="field-row">
            <label>别名</label>
            <input v-model="rule.alias" />
          </div>
          <div class="field-row">
            <label>显示名</label>
            <input v-model="rule.label" />
          </div>
          <button class="toolbar-button danger row-span" @click="removeRow(draft.data.pivotColumns, rule.id)">删除</button>
        </div>
        <div class="section-actions">
          <button class="toolbar-button" @click="addPivotRule">新增行转列字段</button>
        </div>
      </section>

      <section v-else-if="draft.category === 'bgl_'" class="config-section">
        <h3>关联配置</h3>
        <div class="field-row">
          <label>关联类型</label>
          <select v-model="draft.data.joinType">
            <option value="inner join">inner join</option>
            <option value="left join">left join</option>
            <option value="right join">right join</option>
            <option value="full join">full join</option>
          </select>
        </div>
        <label class="inline-toggle">
          <input v-model="draft.data.distinct" type="checkbox" />
          <span>关联后按输出列去重</span>
        </label>
        <div v-for="condition in draft.data.conditions" :key="condition.id" class="row-card row-grid">
          <div class="field-row">
            <label>左列</label>
            <select v-model="condition.leftColumn">
              <option value="">请选择</option>
              <option v-for="column in upstream.left" :key="column.name" :value="column.name">{{ column.label }}</option>
            </select>
          </div>
          <div class="field-row">
            <label>操作符</label>
            <select v-model="condition.operator">
              <option value="equal">=</option>
              <option value="notEqual"><></option>
            </select>
          </div>
          <div class="field-row">
            <label>右列</label>
            <select v-model="condition.rightColumn">
              <option value="">请选择</option>
              <option v-for="column in upstream.right" :key="column.name" :value="column.name">{{ column.label }}</option>
            </select>
          </div>
          <button class="toolbar-button danger row-span" @click="removeRow(draft.data.conditions, condition.id)">删除</button>
        </div>
        <div class="section-actions">
          <button class="toolbar-button" @click="addJoinCondition">新增关联条件</button>
        </div>
        <div class="field-row">
          <label>输出模式</label>
          <select v-model="draft.data.outputMode">
            <option value="all">全部输出</option>
            <option value="manual">手工选择输出列</option>
          </select>
        </div>
        <div v-if="draft.data.outputMode === 'manual'" class="checkbox-grid">
          <label v-for="column in joinSelectableColumns" :key="column.value">
            <input
              :checked="isJoinColumnSelected(column)"
              type="checkbox"
              @change="toggleJoinColumn(column, $event.target.checked)"
            />
            <span>{{ column.label }}</span>
          </label>
        </div>
      </section>

      <section v-else-if="draft.category === 'bbj_'" class="config-section">
        <h3>并集配置</h3>
        <div class="field-row">
          <label>并集模式</label>
          <select v-model="draft.data.unionMode">
            <option value="union">union</option>
            <option value="union all">union all</option>
          </select>
        </div>
        <div class="checkbox-grid">
          <label v-for="column in unionColumns" :key="column.name">
            <input v-model="unionSelection" type="checkbox" :value="column.name" />
            <span>{{ column.label }}</span>
          </label>
        </div>
      </section>

      <section v-else-if="simpleRuleCategoryMap[draft.category]" class="config-section">
        <h3>{{ simpleRuleCategoryMap[draft.category].title }}</h3>
        <div v-for="rule in draft.data.rules" :key="rule.id" class="row-card row-grid">
          <template v-if="draft.category === 'substr_'">
            <div class="field-row">
              <label>源列</label>
              <select v-model="rule.sourceColumn">
                <option value="">请选择</option>
                <option v-for="column in upstream.primary" :key="column.name" :value="column.name">{{ column.label }}</option>
              </select>
            </div>
            <div class="field-row">
              <label>开始位</label>
              <input v-model="rule.start" type="number" />
            </div>
            <div class="field-row">
              <label>长度</label>
              <input v-model="rule.length" type="number" />
            </div>
          </template>
          <template v-else-if="draft.category === 'replace_'">
            <div class="field-row">
              <label>源列</label>
              <select v-model="rule.sourceColumn">
                <option value="">请选择</option>
                <option v-for="column in upstream.primary" :key="column.name" :value="column.name">{{ column.label }}</option>
              </select>
            </div>
            <div class="field-row">
              <label>原值</label>
              <input v-model="rule.from" />
            </div>
            <div class="field-row">
              <label>替换值</label>
              <input v-model="rule.to" />
            </div>
          </template>
          <template v-else-if="draft.category === 'concat_'">
            <div class="field-row row-span">
              <label>源列</label>
              <div class="checkbox-grid">
                <label v-for="column in upstream.primary" :key="column.name">
                  <input v-model="rule.sourceColumns" type="checkbox" :value="column.name" />
                  <span>{{ column.label }}</span>
                </label>
              </div>
            </div>
            <div class="field-row">
              <label>分隔符</label>
              <input v-model="rule.separator" />
            </div>
          </template>
          <template v-else-if="draft.category === 'convert_'">
            <div class="field-row">
              <label>源列</label>
              <select v-model="rule.sourceColumn">
                <option value="">请选择</option>
                <option v-for="column in upstream.primary" :key="column.name" :value="column.name">{{ column.label }}</option>
              </select>
            </div>
            <div class="field-row">
              <label>转换模式</label>
              <select v-model="rule.mode">
                <option value="charToNumeric">charToNumeric</option>
                <option value="numericToChar">numericToChar</option>
              </select>
            </div>
          </template>

          <div class="field-row">
            <label>别名</label>
            <input v-model="rule.alias" />
          </div>
          <div class="field-row">
            <label>显示名</label>
            <input v-model="rule.label" />
          </div>
          <button class="toolbar-button danger row-span" @click="removeRow(draft.data.rules, rule.id)">删除</button>
        </div>
        <div class="section-actions">
          <button class="toolbar-button" @click="addSimpleRule(draft.category)">新增规则</button>
        </div>
      </section>

      <section v-else-if="draft.category === 'order_'" class="config-section">
        <h3>排序配置</h3>
        <div v-for="row in draft.data.orders" :key="row.id" class="row-card row-grid">
          <div class="field-row">
            <label>列</label>
            <select v-model="row.column">
              <option value="">请选择</option>
              <option v-for="column in upstream.primary" :key="column.name" :value="column.name">{{ column.label }}</option>
            </select>
          </div>
          <div class="field-row">
            <label>方向</label>
            <select v-model="row.direction">
              <option value="asc">asc</option>
              <option value="desc">desc</option>
            </select>
          </div>
          <button class="toolbar-button danger row-span" @click="removeRow(draft.data.orders, row.id)">删除</button>
        </div>
        <div class="section-actions">
          <button class="toolbar-button" @click="addOrderRule">新增排序</button>
        </div>
        <div class="field-row">
          <label>限制行数</label>
          <input v-model="draft.data.limit" type="number" />
        </div>
      </section>

      <section v-else-if="draft.category === 'partitionOrder_'" class="config-section">
        <h3>分组排序配置</h3>
        <div class="field-row">
          <label>分组列</label>
          <div class="checkbox-grid">
            <label v-for="column in upstream.primary" :key="column.name">
              <input v-model="draft.data.partitions" type="checkbox" :value="column.name" />
              <span>{{ column.label }}</span>
            </label>
          </div>
        </div>
        <div v-for="row in draft.data.orders" :key="row.id" class="row-card row-grid">
          <div class="field-row">
            <label>排序列</label>
            <select v-model="row.column">
              <option value="">请选择</option>
              <option v-for="column in upstream.primary" :key="column.name" :value="column.name">{{ column.label }}</option>
            </select>
          </div>
          <div class="field-row">
            <label>方向</label>
            <select v-model="row.direction">
              <option value="asc">asc</option>
              <option value="desc">desc</option>
            </select>
          </div>
          <button class="toolbar-button danger row-span" @click="removeRow(draft.data.orders, row.id)">删除</button>
        </div>
        <div class="section-actions">
          <button class="toolbar-button" @click="addPartitionOrderRule">新增排序</button>
        </div>
        <div class="field-row">
          <label>保留前 N</label>
          <input v-model="draft.data.topN" type="number" />
        </div>
        <div class="field-row">
          <label>排名列别名</label>
          <input v-model="draft.data.rankAlias" />
        </div>
      </section>

      <section v-else-if="draft.category === 'removeRepeat_'" class="config-section">
        <h3>去重列</h3>
        <div class="checkbox-grid">
          <label v-for="column in upstream.primary" :key="column.name">
            <input v-model="draft.data.distinctColumns" type="checkbox" :value="column.name" />
            <span>{{ column.label }}</span>
          </label>
        </div>
      </section>

      <section v-else-if="draft.category === 'bsc_'" class="config-section">
        <h3>输出映射</h3>
        <div class="field-row">
          <label>输出表名</label>
          <input v-model="draft.data.outputTable" placeholder="例如 self_owned.dws_tea_order" />
        </div>
        <div class="checkbox-grid">
          <label v-for="column in upstream.primary" :key="column.name">
            <input v-model="draft.data.selectedColumns" type="checkbox" :value="column.name" />
            <span>{{ column.label }}</span>
          </label>
        </div>
        <div v-for="columnName in outputAliasTargetColumns" :key="columnName" class="field-row">
          <label>{{ columnName }} 的输出别名</label>
          <input v-model="draft.data.aliases[columnName]" placeholder="留空表示不改名" />
        </div>
      </section>

      <section class="config-section">
        <h3>当前输出列</h3>
        <div v-if="currentColumns.length === 0" class="empty-hint">当前节点还没有可推导输出列，通常是因为上游分支还没连完。</div>
        <div v-else class="column-list">
          <div v-for="column in currentColumns" :key="column.name" class="column-item">
            <strong>{{ column.name }}</strong>
            <span>{{ column.label }}</span>
          </div>
        </div>
      </section>
    </template>
  </aside>
</template>

<script setup>
/**
 * @author: zhjj
 */
import { computed, ref, watch } from "vue";
import { cloneNode } from "../core/graph/nodeFactory";

const props = defineProps({
  selectedNode: {
    type: Object,
    default: null,
  },
  upstream: {
    type: Object,
    default: () => ({ primary: [], left: [], right: [] }),
  },
  currentColumns: {
    type: Array,
    default: () => [],
  },
  modal: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update-node"]);

const draft = ref(null);

watch(
  () => props.selectedNode,
  (value) => {
    draft.value = value ? cloneNode(value) : null;
  },
  { immediate: true }
);

const joinSelectableColumns = computed(() => [
  ...props.upstream.left.map((column) => ({
    side: "left",
    value: `left:${column.name}`,
    label: `左 · ${column.label}`,
    name: column.name,
  })),
  ...props.upstream.right.map((column) => ({
    side: "right",
    value: `right:${column.name}`,
    label: `右 · ${column.label}`,
    name: column.name,
  })),
]);

const unionColumns = computed(() => {
  const rightNames = new Set(props.upstream.right.map((column) => column.name));
  return props.upstream.left.filter((column) => rightNames.has(column.name));
});

const unionSelection = computed({
  get: () => (draft.value?.data.selectedColumns || []).map((item) => item.name || item),
  set: (values) => {
    if (!draft.value) {
      return;
    }
    draft.value.data.selectedColumns = values.map((value) => ({ name: value, label: value }));
  },
});

const outputAliasTargetColumns = computed(() => {
  if (!draft.value) {
    return [];
  }
  const selected = draft.value.data.selectedColumns || [];
  return selected.length > 0 ? selected : props.upstream.primary.map((column) => column.name);
});

const simpleRuleCategoryMap = {
  substr_: { title: "字符串截取" },
  replace_: { title: "字符串替换" },
  concat_: { title: "字符串拼接" },
  convert_: { title: "类型转换" },
};

const removeRow = (collection, rowId) => {
  const index = collection.findIndex((item) => item.id === rowId);
  if (index >= 0) {
    collection.splice(index, 1);
  }
};

const makeId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

const addSourceExtraColumn = () => draft.value.data.extraColumns.push({ id: makeId("extra"), alias: "", label: "", expression: "" });
const addFilterCondition = () =>
  draft.value.data.conditions.push({ id: makeId("cond"), column: "", operator: "equal", value: "", valueType: "literal" });
const addNewColumnRule = () => draft.value.data.rules.push({ id: makeId("newcol"), alias: "", label: "", expression: "" });
const addAggregateRule = () =>
  draft.value.data.aggregates.push({ id: makeId("agg"), func: "sum", column: "", alias: "", label: "", havingOperator: "", havingValue: "" });
const addPivotRule = () =>
  draft.value.data.pivotColumns.push({ id: makeId("pivot"), sourceColumn: "", orderColumn: "", alias: "", label: "" });
const addJoinCondition = () => draft.value.data.conditions.push({ id: makeId("join"), leftColumn: "", operator: "equal", rightColumn: "" });
const addOrderRule = () => draft.value.data.orders.push({ id: makeId("order"), column: "", direction: "desc" });
const addPartitionOrderRule = () => draft.value.data.orders.push({ id: makeId("partition"), column: "", direction: "desc" });

const addSimpleRule = (category) => {
  const mapping = {
    substr_: { id: makeId("substr"), sourceColumn: "", start: 1, length: 7, alias: "", label: "" },
    replace_: { id: makeId("replace"), sourceColumn: "", from: "", to: "", alias: "", label: "" },
    concat_: { id: makeId("concat"), sourceColumns: [], separator: "-", alias: "", label: "" },
    convert_: { id: makeId("convert"), sourceColumn: "", mode: "charToNumeric", alias: "", label: "" },
  };
  draft.value.data.rules.push(mapping[category]);
};

const isJoinColumnSelected = (column) =>
  (draft.value?.data.selectedColumns || []).some((item) => item.side === column.side && item.name === column.name);

const toggleJoinColumn = (column, checked) => {
  const current = draft.value.data.selectedColumns || [];
  draft.value.data.selectedColumns = checked
    ? [...current, { side: column.side, name: column.name, alias: "", label: column.label }]
    : current.filter((item) => !(item.side === column.side && item.name === column.name));
};

const applyChanges = () => {
  if (!draft.value) {
    return;
  }
  emit("update-node", cloneNode(draft.value));
};
</script>

<style scoped>
.config {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 18px;
  height: 100%;
  min-height: 0;
  overflow: auto;
  border-radius: 28px;
}

.config.modal {
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}

.config-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.config-head h2 {
  margin: 6px 0 0;
  font-family: var(--font-title);
  font-size: clamp(20px, 1.5vw, 24px);
}

.identity {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.64);
}

.identity div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.config-section {
  display: grid;
  gap: 12px;
}

.config-section h3 {
  margin: 0;
  font-size: 15px;
}

.section-actions {
  display: flex;
  justify-content: flex-start;
}

.row-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid rgba(32, 49, 38, 0.08);
  background: rgba(255, 255, 255, 0.72);
}

.row-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.row-span {
  grid-column: 1 / -1;
}

.checkbox-grid {
  display: grid;
  gap: 8px;
}

.checkbox-grid label,
.inline-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(32, 49, 38, 0.08);
  background: rgba(255, 255, 255, 0.72);
}

.checkbox-grid em {
  color: var(--text-soft);
  font-style: normal;
}

.column-list {
  display: grid;
  gap: 8px;
}

.column-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(32, 49, 38, 0.08);
  background: rgba(255, 255, 255, 0.72);
}

.surface-sub {
  border: 1px solid rgba(32, 49, 38, 0.08);
}

@media (max-width: 1380px) {
  .config {
    padding: 18px 14px;
  }

  .row-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 860px) {
  .config-head {
    align-items: stretch;
    flex-direction: column;
  }

  .row-grid {
    grid-template-columns: 1fr;
  }
}
</style>
