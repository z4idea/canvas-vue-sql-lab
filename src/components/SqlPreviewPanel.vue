<!-- @author: zhjj -->
<template>
  <section class="preview surface" :class="{ compact }">
    <div class="preview-head">
      <div>
        <p class="eyebrow">Front-end Compiler</p>
        <h2>SQL 预览</h2>
      </div>
      <span class="chip">{{ dialect }}</span>
    </div>

    <div v-if="error" class="error-box">
      {{ error }}
    </div>

    <div v-else-if="!result" class="empty-hint">
      先拖入数据集和算子，并至少放一个输出表节点。编译器会从输出节点逆向回溯整张图并生成 SQL。
    </div>

    <template v-else>
      <div class="summary-grid">
        <div class="surface-sub summary-card">
          <span>输出节点</span>
          <strong>{{ result.nodeId }}</strong>
        </div>
        <div class="surface-sub summary-card">
          <span>输出表</span>
          <strong>{{ result.outputTable || "未命名" }}</strong>
        </div>
        <div class="surface-sub summary-card">
          <span>输出列数</span>
          <strong>{{ result.columns.length }}</strong>
        </div>
      </div>

      <div class="preview-columns">
        <div class="section-label">输出列</div>
        <div class="column-tags">
          <span v-for="column in result.columns" :key="column.name" class="chip">
            {{ column.name }}
          </span>
        </div>
      </div>

      <div class="section-head">
        <div class="section-label">生成 SQL</div>
        <label class="inline-toggle">
          <input v-model="enableSimplify" type="checkbox" />
          <span>简化处理</span>
        </label>
      </div>
      <pre class="sql-block">{{ formattedSql }}</pre>

      <template v-if="enableSimplify">
        <div class="section-label">简化后 SQL</div>
        <div class="helper-note">启发式简化，只会收掉确定冗余的包裹层，不能保证对所有 SQL 完美等价。</div>
        <pre class="sql-block">{{ simplifiedFormattedSql }}</pre>
      </template>
    </template>
  </section>
</template>

<script setup>
/**
 * @author: zhjj
 */
import { computed, ref } from "vue";

const props = defineProps({
  result: {
    type: Object,
    default: null,
  },
  error: {
    type: String,
    default: "",
  },
  dialect: {
    type: String,
    default: "mysql",
  },
  compact: {
    type: Boolean,
    default: false,
  },
});

const CLAUSE_PATTERNS = [
  "UNION ALL",
  "GROUP BY",
  "ORDER BY",
  "INNER JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "FULL JOIN",
  "CROSS JOIN",
  "SELECT",
  "FROM",
  "WHERE",
  "HAVING",
  "LIMIT",
  "UNION",
  "JOIN",
  "ON",
  "AND",
  "OR",
];

const COMMA_BREAK_CLAUSES = new Set(["SELECT", "GROUP BY", "ORDER BY"]);
const KEYWORDS_WITH_DEEPER_INDENT = new Set(["AND", "OR"]);
const enableSimplify = ref(false);

const formattedSql = computed(() => {
  if (!props.result?.sql) {
    return "";
  }
  return formatSql(props.result.sql);
});

const simplifiedFormattedSql = computed(() => {
  if (!props.result?.sql) {
    return "";
  }
  return formatSql(simplifyGeneratedSql(props.result.sql));
});

function formatSql(sql) {
  const normalized = normalizeSql(sql);
  let output = "";
  let depth = 0;
  let index = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let currentClause = "";
  let clauseDepth = 0;

  while (index < normalized.length) {
    const char = normalized[index];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      output += char;
      index += 1;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      output += char;
      index += 1;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      const clause = detectClause(normalized, index);
      if (clause) {
        const indentDepth = KEYWORDS_WITH_DEEPER_INDENT.has(clause) ? clauseDepth + 1 : depth;
        output = appendClause(output, clause, indentDepth);
        currentClause = clause;
        clauseDepth = depth;
        index += clause.length;
        continue;
      }

      if (char === "(") {
        output = trimRight(output);
        output += " (";
        depth += 1;
        index += 1;
        continue;
      }

      if (char === ")") {
        depth = Math.max(depth - 1, 0);
        output = trimRight(output);
        output += `\n${indent(depth)})`;
        index += 1;
        continue;
      }

      if (char === ",") {
        output = trimRight(output);
        if (COMMA_BREAK_CLAUSES.has(currentClause) && depth === clauseDepth) {
          output += `,\n${indent(clauseDepth + 1)}`;
        } else {
          output += ", ";
        }
        index += 1;
        continue;
      }
    }

    output += char;
    index += 1;
  }

  return output
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function appendClause(output, clause, depth) {
  const prefix = output.trim().length ? "\n" : "";
  return `${trimRight(output)}${prefix}${indent(depth)}${clause} `;
}

function detectClause(sql, index) {
  for (const pattern of CLAUSE_PATTERNS) {
    if (
      sql.slice(index, index + pattern.length).toUpperCase() === pattern &&
      isWordBoundary(sql, index - 1) &&
      isWordBoundary(sql, index + pattern.length)
    ) {
      return pattern;
    }
  }
  return "";
}

function isWordBoundary(sql, index) {
  if (index < 0 || index >= sql.length) {
    return true;
  }
  return !/[A-Za-z0-9_]/.test(sql[index]);
}

function normalizeSql(sql) {
  let normalized = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let lastWasSpace = false;

  for (const char of sql.trim()) {
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      normalized += char;
      lastWasSpace = false;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      normalized += char;
      lastWasSpace = false;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && /\s/.test(char)) {
      if (!lastWasSpace) {
        normalized += " ";
        lastWasSpace = true;
      }
      continue;
    }

    normalized += char;
    lastWasSpace = false;
  }

  return normalized;
}

function trimRight(value) {
  return value.replace(/[ \t]+$/g, "");
}

function indent(depth) {
  return "  ".repeat(Math.max(depth, 0));
}

function simplifyGeneratedSql(sql) {
  let current = normalizeSql(sql);
  let changed = true;

  while (changed) {
    changed = false;
    const collapsedIdentity = collapseIdentityWrapper(current);
    if (collapsedIdentity !== current) {
      current = collapsedIdentity;
      changed = true;
    }
    const collapsedDistinct = collapseDistinctWrapper(current);
    if (collapsedDistinct !== current) {
      current = collapsedDistinct;
      changed = true;
    }
    const inlinedSource = inlinePlainSourceWrapper(current);
    if (inlinedSource !== current) {
      current = inlinedSource;
      changed = true;
    }
  }

  return current;
}

function collapseIdentityWrapper(sql) {
  const parsed = parseSelectStatement(sql);
  if (!parsed?.from?.subquery || parsed.where || parsed.groupBy || parsed.having || parsed.orderBy || parsed.limit) {
    return sql;
  }
  const inner = parseSelectStatement(parsed.from.subquery);
  if (!inner || inner.where || inner.groupBy || inner.having || inner.orderBy || inner.limit) {
    return sql;
  }
  const outerItems = splitTopLevel(parsed.select);
  const innerItems = splitTopLevel(inner.select);
  if (!sameProjectionList(outerItems, innerItems)) {
    return sql;
  }
  return parsed.from.subquery;
}

function collapseDistinctWrapper(sql) {
  const outer = parseSelectStatement(sql);
  if (!outer?.from?.subquery || outer.where || outer.having || outer.orderBy || outer.limit) {
    return sql;
  }
  const inner = parseSelectStatement(outer.from.subquery);
  if (!inner?.from?.subquery || inner.where || inner.having || inner.orderBy || inner.limit || !inner.groupBy) {
    return sql;
  }
  const innerProjection = splitTopLevel(inner.select);
  const groupItems = splitTopLevel(inner.groupBy);
  const outerProjection = splitTopLevel(outer.select);

  if (!allPlainIdentifiers(innerProjection) || !allPlainIdentifiers(groupItems) || !allPlainIdentifiers(outerProjection)) {
    return sql;
  }
  if (!sameIdentifierSet(innerProjection, groupItems)) {
    return sql;
  }
  if (!isSubsetProjection(outerProjection, innerProjection)) {
    return sql;
  }

  return `select ${outer.select} from (${inner.from.subquery}) ${outer.from.alias || "tab_simplified"}`;
}

function inlinePlainSourceWrapper(sql) {
  const outer = parseSelectStatement(sql);
  if (!outer?.from?.subquery) {
    return sql;
  }
  const inner = parseSelectStatement(outer.from.subquery);
  if (!inner || inner.where || inner.groupBy || inner.having || inner.orderBy || inner.limit || inner.from?.subquery) {
    return sql;
  }
  const innerProjection = splitTopLevel(inner.select);
  if (!allPlainIdentifiers(innerProjection)) {
    return sql;
  }
  return rebuildStatement({
    ...outer,
    fromRaw: inner.fromRaw,
    from: null,
  });
}

function rebuildStatement(parsed) {
  const parts = [`select ${parsed.select}`, `from ${parsed.fromRaw}`];
  if (parsed.where) {
    parts.push(`where ${parsed.where}`);
  }
  if (parsed.groupBy) {
    parts.push(`group by ${parsed.groupBy}`);
  }
  if (parsed.having) {
    parts.push(`having ${parsed.having}`);
  }
  if (parsed.orderBy) {
    parts.push(`order by ${parsed.orderBy}`);
  }
  if (parsed.limit) {
    parts.push(`limit ${parsed.limit}`);
  }
  return parts.join(" ");
}

function parseSelectStatement(sql) {
  const normalized = normalizeSql(sql).replace(/;$/, "");
  if (!normalized.toLowerCase().startsWith("select ")) {
    return null;
  }
  const fromIndex = findTopLevelKeyword(normalized, "from", 6);
  if (fromIndex < 0) {
    return null;
  }
  const clauseIndexes = [
    ["where", findTopLevelKeyword(normalized, "where", fromIndex + 4)],
    ["group by", findTopLevelKeyword(normalized, "group by", fromIndex + 4)],
    ["having", findTopLevelKeyword(normalized, "having", fromIndex + 4)],
    ["order by", findTopLevelKeyword(normalized, "order by", fromIndex + 4)],
    ["limit", findTopLevelKeyword(normalized, "limit", fromIndex + 4)],
  ].filter(([, index]) => index >= 0);

  const nextBoundary = clauseIndexes.length > 0 ? Math.min(...clauseIndexes.map(([, index]) => index)) : normalized.length;
  const select = normalized.slice(6, fromIndex).trim();
  const fromRaw = normalized.slice(fromIndex + 4, nextBoundary).trim();

  return {
    raw: normalized,
    select,
    fromRaw,
    from: parseFromClause(fromRaw),
    where: readClause(normalized, clauseIndexes, "where", "where".length),
    groupBy: readClause(normalized, clauseIndexes, "group by", "group by".length),
    having: readClause(normalized, clauseIndexes, "having", "having".length),
    orderBy: readClause(normalized, clauseIndexes, "order by", "order by".length),
    limit: readClause(normalized, clauseIndexes, "limit", "limit".length),
  };
}

function readClause(sql, clauseIndexes, name, keywordLength) {
  const current = clauseIndexes.find(([clauseName]) => clauseName === name);
  if (!current) {
    return "";
  }
  const [, start] = current;
  const later = clauseIndexes
    .map(([, index]) => index)
    .filter((index) => index > start);
  const end = later.length > 0 ? Math.min(...later) : sql.length;
  return sql.slice(start + keywordLength, end).trim();
}

function parseFromClause(fromRaw) {
  if (!fromRaw.startsWith("(")) {
    return null;
  }
  const closeIndex = findMatchingParen(fromRaw, 0);
  if (closeIndex < 0) {
    return null;
  }
  const subquery = fromRaw.slice(1, closeIndex).trim();
  const alias = fromRaw.slice(closeIndex + 1).trim();
  if (!alias) {
    return null;
  }
  return { subquery, alias };
}

function findMatchingParen(text, start) {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (inSingleQuote || inDoubleQuote) {
      continue;
    }
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function findTopLevelKeyword(sql, keyword, start = 0) {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  const target = keyword.toLowerCase();

  for (let index = start; index <= sql.length - target.length; index += 1) {
    const char = sql[index];
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (inSingleQuote || inDoubleQuote) {
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth = Math.max(depth - 1, 0);
      continue;
    }
    if (depth !== 0) {
      continue;
    }
    if (
      sql.slice(index, index + target.length).toLowerCase() === target &&
      isKeywordBoundary(sql, index - 1) &&
      isKeywordBoundary(sql, index + target.length)
    ) {
      return index;
    }
  }
  return -1;
}

function isKeywordBoundary(sql, index) {
  if (index < 0 || index >= sql.length) {
    return true;
  }
  return !/[A-Za-z0-9_.]/.test(sql[index]);
}

function splitTopLevel(text) {
  const items = [];
  let current = "";
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }
    if (!inSingleQuote && !inDoubleQuote) {
      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth = Math.max(depth - 1, 0);
      } else if (char === "," && depth === 0) {
        items.push(current.trim());
        current = "";
        continue;
      }
    }
    current += char;
  }
  if (current.trim()) {
    items.push(current.trim());
  }
  return items;
}

function normalizeIdentifierItem(item) {
  return item
    .trim()
    .replace(/\s+as\s+/i, " as ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function sameProjectionList(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => normalizeIdentifierItem(item) === normalizeIdentifierItem(right[index]));
}

function allPlainIdentifiers(items) {
  return items.every((item) => /^[A-Za-z0-9_.]+$/.test(item.trim()));
}

function sameIdentifierSet(left, right) {
  const leftNormalized = left.map((item) => normalizeIdentifierItem(item));
  const rightNormalized = right.map((item) => normalizeIdentifierItem(item));
  return leftNormalized.length === rightNormalized.length && leftNormalized.every((item, index) => item === rightNormalized[index]);
}

function isSubsetProjection(subset, full) {
  const all = new Set(full.map((item) => normalizeIdentifierItem(item)));
  return subset.every((item) => all.has(normalizeIdentifierItem(item)));
}
</script>

<style scoped>
.preview {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 18px;
  border-radius: 28px;
}

.preview.compact {
  padding: 8px 4px 4px;
  border-radius: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
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

.error-box {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(180, 73, 54, 0.16);
  background: rgba(180, 73, 54, 0.08);
  color: var(--danger);
  line-height: 1.6;
}

.summary-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

.preview-columns {
  display: grid;
  gap: 10px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-label {
  font-weight: 700;
}

.inline-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid rgba(32, 49, 38, 0.08);
  background: rgba(255, 255, 255, 0.76);
  font-size: 13px;
}

.column-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.helper-note {
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.5;
}

.sql-block {
  margin: 0;
  padding: 18px;
  border-radius: 18px;
  background: #14231d;
  color: #d8efe2;
  overflow: auto;
  line-height: 1.65;
  font-size: 13px;
}

.surface-sub {
  border: 1px solid rgba(32, 49, 38, 0.08);
}

@media (max-width: 900px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .section-head {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
