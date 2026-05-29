/**
 * @author: zhjj
 */
import { byId, getIncomingEdges, getIncomingMap, getRequiredInputHandles } from "../graph/graphUtils.js";
import { getDatasetById } from "../catalog/datasets.js";

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const stripQualifier = (name) => {
  if (!name) {
    return name;
  }
  const index = String(name).lastIndexOf(".");
  return index >= 0 ? String(name).slice(index + 1) : String(name);
};

const toNumber = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

const toComparableValue = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  return value;
};

const cloneRows = (rows) => ensureArray(rows).map((row) => ({ ...row }));

const sortByColumns = (rows, columns) =>
  [...rows].sort((left, right) => {
    for (const column of columns) {
      const leftValue = toComparableValue(left[stripQualifier(column)]);
      const rightValue = toComparableValue(right[stripQualifier(column)]);
      if (leftValue === rightValue) {
        continue;
      }
      return leftValue > rightValue ? 1 : -1;
    }
    return 0;
  });

const dedupeRows = (rows, columns) => {
  const seen = new Set();
  const names = columns.map((column) => stripQualifier(column.name || column));
  return rows.filter((row) => {
    const key = JSON.stringify(names.map((name) => row[name]));
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const createPreviewContext = (graph, options = {}) => ({
  graph,
  dialect: options.dialect || "mysql",
  nodeMap: byId(graph.nodes),
  cache: new Map(),
});

const helperFns = {
  substr(value, start, length) {
    const text = value == null ? "" : String(value);
    const offset = Math.max(Number(start || 1) - 1, 0);
    const size = Number(length || text.length);
    return text.slice(offset, offset + size);
  },
  replace(value, from, to) {
    return String(value ?? "").split(String(from ?? "")).join(String(to ?? ""));
  },
  concat(...values) {
    return values.map((item) => (item == null ? "" : String(item))).join("");
  },
  concat_ws(separator, ...values) {
    return values
      .filter((item) => item !== null && item !== undefined && item !== "")
      .map((item) => String(item))
      .join(separator ?? "");
  },
  toChar(value) {
    return value == null ? "" : String(value);
  },
  toNumber(value) {
    return Number(value ?? 0);
  },
  round(value, digits = 0) {
    const base = 10 ** Number(digits || 0);
    return Math.round(Number(value || 0) * base) / base;
  },
};

const translateSqlExpression = (expression) =>
  String(expression || "")
    .replace(/\bsubstr\s*\(/gi, "helpers.substr(")
    .replace(/\bsubstring\s*\(/gi, "helpers.substr(")
    .replace(/\breplace\s*\(/gi, "helpers.replace(")
    .replace(/\bconcat_ws\s*\(/gi, "helpers.concat_ws(")
    .replace(/\bconcat\s*\(/gi, "helpers.concat(")
    .replace(/\bto_char\s*\(/gi, "helpers.toChar(")
    .replace(/\bround\s*\(/gi, "helpers.round(")
    .replace(/\bto_number\s*\(\s*([^,()]+?)\s*(?:,\s*[^)]+)?\)/gi, "helpers.toNumber($1)")
    .replace(/\bcast\s*\(\s*([^)]+?)\s+as\s+char\s*\)/gi, "helpers.toChar($1)")
    .replace(/\bcast\s*\(\s*([^)]+?)\s+as\s+varchar\s*\)/gi, "helpers.toChar($1)")
    .replace(/\bcast\s*\(\s*([^)]+?)\s+as\s+numeric(?:\([^)]*\))?\s*\)/gi, "helpers.toNumber($1)");

const evaluateExpression = (expression, row) => {
  if (!expression) {
    return null;
  }
  try {
    const compiled = new Function("row", "helpers", `with (row) { return (${translateSqlExpression(expression)}); }`);
    return compiled(row, helperFns);
  } catch {
    return null;
  }
};

const evaluateCondition = (row, condition) => {
  const columnValue = row[stripQualifier(condition.column)];
  const rawValue =
    condition.valueType === "expression" ? evaluateExpression(condition.value, row) : condition.value ?? "";
  const left = toComparableValue(columnValue);
  const right = toComparableValue(rawValue);

  switch (condition.operator) {
    case "equal":
      return String(left) === String(right);
    case "notEqual":
      return String(left) !== String(right);
    case "greaterThan":
      return Number(left) > Number(right);
    case "greaterThanEqual":
      return Number(left) >= Number(right);
    case "lessThan":
      return Number(left) < Number(right);
    case "lessThanEqual":
      return Number(left) <= Number(right);
    case "like":
      return String(left).includes(String(right));
    case "notLike":
      return !String(left).includes(String(right));
    case "beginsWith":
      return String(left).startsWith(String(right));
    case "endsWith":
      return String(left).endsWith(String(right));
    case "isNull":
      return columnValue === null || columnValue === undefined || columnValue === "";
    case "isNotNull":
      return !(columnValue === null || columnValue === undefined || columnValue === "");
    default:
      return true;
  }
};

const applyConditions = (rows, conditions, logic) => {
  const normalized = ensureArray(conditions).filter((condition) => condition.column || condition.operator?.includes("Null"));
  if (normalized.length === 0) {
    return rows;
  }
  return rows.filter((row) => {
    const results = normalized.map((condition) => evaluateCondition(row, condition));
    return logic === "or" ? results.some(Boolean) : results.every(Boolean);
  });
};

const aggregateRows = (rows, aggregate) => {
  const values = rows
    .map((row) => row[stripQualifier(aggregate.column)])
    .filter((value) => value !== null && value !== undefined && value !== "");
  switch (aggregate.func) {
    case "count":
      return rows.length;
    case "distinctCount":
      return new Set(values.map((value) => JSON.stringify(value))).size;
    case "sum":
      return values.reduce((sum, value) => sum + toNumber(value), 0);
    case "max":
      return values.reduce((current, value) => (current > value ? current : value), values[0] ?? null);
    case "min":
      return values.reduce((current, value) => (current < value ? current : value), values[0] ?? null);
    case "avg":
      return values.length === 0 ? 0 : Number((values.reduce((sum, value) => sum + toNumber(value), 0) / values.length).toFixed(2));
    default:
      return null;
  }
};

const passesHaving = (row, aggregates) =>
  ensureArray(aggregates)
    .filter((aggregate) => aggregate.havingOperator && aggregate.havingValue !== "")
    .every((aggregate) => {
      const left = toNumber(row[aggregate.alias]);
      const right = toNumber(aggregate.havingValue);
      switch (aggregate.havingOperator) {
        case ">":
          return left > right;
        case ">=":
          return left >= right;
        case "<":
          return left < right;
        case "<=":
          return left <= right;
        case "=":
          return left === right;
        default:
          return true;
      }
    });

const compilePreviewInternal = (context, nodeId) => {
  if (context.cache.has(nodeId)) {
    return context.cache.get(nodeId);
  }
  const node = context.nodeMap[nodeId];
  if (!node) {
    throw new Error(`节点不存在: ${nodeId}`);
  }

  const requiredHandles = getRequiredInputHandles(node);
  if (requiredHandles.length > 0) {
    const incomingMap = getIncomingMap(context.graph.edges, node.id);
    for (const handle of requiredHandles) {
      if (!incomingMap[handle]) {
        throw new Error(`${node.title} 缺少输入分支: ${handle}`);
      }
    }
  }

  const result = node.kind === "dataset" ? previewDatasetNode(node) : previewOperatorNode(context, node);
  context.cache.set(nodeId, result);
  return result;
};

const previewDatasetNode = (node) => {
  const dataset = getDatasetById(node.data.datasetId);
  if (!dataset) {
    throw new Error(`数据集不存在: ${node.data.datasetId}`);
  }

  const selectedColumns = ensureArray(node.data.selectedColumns);
  const baseColumns = dataset.columns
    .filter((column) => selectedColumns.length === 0 || selectedColumns.includes(column.name))
    .map((column) => ({ name: stripQualifier(column.name), label: column.label || column.name }));

  const rows = cloneRows(dataset.rows).map((row) => {
    const nextRow = {};
    for (const column of baseColumns) {
      nextRow[column.name] = row[column.name];
    }
    for (const extraColumn of ensureArray(node.data.extraColumns).filter((item) => item.alias && item.expression)) {
      nextRow[extraColumn.alias] = evaluateExpression(extraColumn.expression, row);
    }
    return nextRow;
  });

  const extraColumns = ensureArray(node.data.extraColumns)
    .filter((item) => item.alias && item.expression)
    .map((item) => ({ name: item.alias, label: item.label || item.alias }));

  return {
    nodeId: node.id,
    title: node.title,
    columns: [...baseColumns, ...extraColumns],
    rows,
    lineageText: node.title,
  };
};

const wrapLineage = (lineageText, nodeTitle) => `${lineageText} -> ${nodeTitle}`;

const previewOperatorNode = (context, node) => {
  const compileUnary = () => {
    const sourceId = getIncomingMap(context.graph.edges, node.id).in;
    return compilePreviewInternal(context, sourceId);
  };

  switch (node.category) {
    case "hgl_":
      return previewFilterNode(node, compileUnary());
    case "newColumn_":
      return previewNewColumnNode(node, compileUnary());
    case "bfz_":
      return previewGroupNode(node, compileUnary());
    case "hzl_":
      return previewPivotNode(node, compileUnary());
    case "bgl_":
      return previewJoinNode(context, node);
    case "bbj_":
      return previewUnionNode(context, node);
    case "substr_":
      return previewTransformNode(node, compileUnary(), (row, rule) =>
        helperFns.substr(row[stripQualifier(rule.sourceColumn)], rule.start, rule.length)
      );
    case "replace_":
      return previewTransformNode(node, compileUnary(), (row, rule) =>
        helperFns.replace(row[stripQualifier(rule.sourceColumn)], rule.from, rule.to)
      );
    case "concat_":
      return previewTransformNode(node, compileUnary(), (row, rule) =>
        helperFns.concat_ws(rule.separator || "-", ...ensureArray(rule.sourceColumns).map((column) => row[stripQualifier(column)]))
      );
    case "convert_":
      return previewTransformNode(node, compileUnary(), (row, rule) =>
        rule.mode === "numericToChar"
          ? helperFns.toChar(row[stripQualifier(rule.sourceColumn)])
          : helperFns.toNumber(row[stripQualifier(rule.sourceColumn)])
      );
    case "order_":
      return previewOrderNode(node, compileUnary());
    case "partitionOrder_":
      return previewPartitionOrderNode(node, compileUnary());
    case "removeRepeat_":
      return previewDistinctNode(node, compileUnary());
    case "bsc_":
      return previewOutputNode(node, compileUnary());
    default:
      throw new Error(`暂不支持当前节点的数据预览: ${node.category}`);
  }
};

const previewFilterNode = (node, upstream) => ({
  nodeId: node.id,
  title: node.title,
  columns: upstream.columns,
  rows: applyConditions(cloneRows(upstream.rows), node.data.conditions, node.data.conditionLogic),
  lineageText: wrapLineage(upstream.lineageText, node.title),
});

const previewNewColumnNode = (node, upstream) => {
  const rules = ensureArray(node.data.rules).filter((rule) => rule.alias && rule.expression);
  const rows = cloneRows(upstream.rows).map((row) => {
    const nextRow = { ...row };
    for (const rule of rules) {
      nextRow[rule.alias] = evaluateExpression(rule.expression, row);
    }
    return nextRow;
  });
  return {
    nodeId: node.id,
    title: node.title,
    columns: [...upstream.columns, ...rules.map((rule) => ({ name: rule.alias, label: rule.label || rule.alias }))],
    rows,
    lineageText: wrapLineage(upstream.lineageText, node.title),
  };
};

const previewGroupNode = (node, upstream) => {
  const groupBys = ensureArray(node.data.groupBys).map((column) => stripQualifier(column));
  const aggregates = ensureArray(node.data.aggregates).filter((item) => item.column && item.alias);
  const groups = new Map();

  for (const row of upstream.rows) {
    const key = JSON.stringify(groupBys.map((column) => row[column]));
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  }

  const rows = [...groups.values()].map((groupRows) => {
    const nextRow = {};
    for (const groupBy of groupBys) {
      nextRow[groupBy] = groupRows[0]?.[groupBy];
    }
    for (const aggregate of aggregates) {
      nextRow[aggregate.alias] = aggregateRows(groupRows, aggregate);
    }
    return nextRow;
  });

  return {
    nodeId: node.id,
    title: node.title,
    columns: [
      ...groupBys.map((column) => ({ name: column, label: column })),
      ...aggregates.map((aggregate) => ({ name: aggregate.alias, label: aggregate.label || aggregate.alias })),
    ],
    rows: rows.filter((row) => passesHaving(row, aggregates)),
    lineageText: wrapLineage(upstream.lineageText, node.title),
  };
};

const previewPivotNode = (node, upstream) => {
  const groupBys = ensureArray(node.data.groupBys).map((column) => stripQualifier(column));
  const pivotColumns = ensureArray(node.data.pivotColumns).filter(
    (column) => column.sourceColumn && column.orderColumn && column.alias
  );
  const groups = new Map();

  for (const row of upstream.rows) {
    const key = JSON.stringify(groupBys.map((column) => row[column]));
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  }

  const rows = [...groups.values()].map((groupRows) => {
    const nextRow = {};
    for (const groupBy of groupBys) {
      nextRow[groupBy] = groupRows[0]?.[groupBy];
    }
    for (const pivot of pivotColumns) {
      const sourceName = stripQualifier(pivot.sourceColumn);
      const orderName = stripQualifier(pivot.orderColumn);
      nextRow[pivot.alias] = sortByColumns(groupRows, [orderName]).map((row) => row[sourceName]).join(",");
    }
    return nextRow;
  });

  return {
    nodeId: node.id,
    title: node.title,
    columns: [
      ...groupBys.map((column) => ({ name: column, label: column })),
      ...pivotColumns.map((column) => ({ name: column.alias, label: column.label || column.alias })),
    ],
    rows,
    lineageText: wrapLineage(upstream.lineageText, node.title),
  };
};

const matchesJoinCondition = (leftRow, rightRow, condition) => {
  const leftValue = leftRow[stripQualifier(condition.leftColumn)];
  const rightValue = rightRow[stripQualifier(condition.rightColumn)];
  if (condition.operator === "notEqual") {
    return String(leftValue) !== String(rightValue);
  }
  return String(leftValue) === String(rightValue);
};

const buildJoinSelectedColumns = (node, left, right) => {
  if (ensureArray(node.data.selectedColumns).length > 0) {
    return ensureArray(node.data.selectedColumns).map((item) => ({
      name: item.alias || item.name,
      label: item.label || item.alias || item.name,
      side: item.side || "left",
      sourceName: item.name,
    }));
  }
  const leftColumns = left.columns.map((column) => ({
    name: column.name,
    label: column.label,
    side: "left",
    sourceName: column.name,
  }));
  const seen = new Set(leftColumns.map((column) => column.name));
  const rightColumns = right.columns.map((column) => ({
    name: seen.has(column.name) ? `${column.name}_right` : column.name,
    label: seen.has(column.name) ? `${column.label} (右)` : column.label,
    side: "right",
    sourceName: column.name,
  }));
  return [...leftColumns, ...rightColumns];
};

const projectJoinRow = (columns, leftRow, rightRow) => {
  const nextRow = {};
  for (const column of columns) {
    const source = column.side === "right" ? rightRow : leftRow;
    nextRow[column.name] = source?.[stripQualifier(column.sourceName || column.name)] ?? null;
  }
  return nextRow;
};

const previewJoinNode = (context, node) => {
  const incomingMap = getIncomingMap(context.graph.edges, node.id);
  const left = compilePreviewInternal(context, incomingMap.left);
  const right = compilePreviewInternal(context, incomingMap.right);
  const conditions = ensureArray(node.data.conditions).filter((item) => item.leftColumn && item.rightColumn);
  const columns = buildJoinSelectedColumns(node, left, right);
  const joinType = node.data.joinType || "inner join";
  const rows = [];
  const matchedRightIndexes = new Set();

  left.rows.forEach((leftRow) => {
    const matched = [];
    right.rows.forEach((rightRow, rightIndex) => {
      const pass =
        conditions.length === 0 || conditions.every((condition) => matchesJoinCondition(leftRow, rightRow, condition));
      if (!pass) {
        return;
      }
      matched.push(projectJoinRow(columns, leftRow, rightRow));
      matchedRightIndexes.add(rightIndex);
    });
    if (matched.length > 0) {
      rows.push(...matched);
      return;
    }
    if (joinType === "left join" || joinType === "full join") {
      rows.push(projectJoinRow(columns, leftRow, {}));
    }
  });

  if (joinType === "right join" || joinType === "full join") {
    right.rows.forEach((rightRow, index) => {
      if (matchedRightIndexes.has(index)) {
        return;
      }
      rows.push(projectJoinRow(columns, {}, rightRow));
    });
  }

  return {
    nodeId: node.id,
    title: node.title,
    columns: columns.map((column) => ({ name: column.name, label: column.label })),
    rows: node.data.distinct === false ? rows : dedupeRows(rows, columns),
    lineageText: `(${left.lineageText}) + (${right.lineageText}) -> ${node.title}`,
  };
};

const previewUnionNode = (context, node) => {
  const incomingMap = getIncomingMap(context.graph.edges, node.id);
  const left = compilePreviewInternal(context, incomingMap.left);
  const right = compilePreviewInternal(context, incomingMap.right);
  const selected = ensureArray(node.data.selectedColumns);
  const columns =
    selected.length > 0
      ? selected.map((column) => ({ name: column.name, label: column.label || column.name }))
      : left.columns.filter((column) => right.columns.some((rightColumn) => rightColumn.name === column.name));
  if (columns.length === 0) {
    throw new Error("并集算子没有找到可预览的公共列。");
  }
  const projectRows = (rows) =>
    rows.map((row) =>
      Object.fromEntries(columns.map((column) => [column.name, row[stripQualifier(column.name)] ?? null]))
    );
  const merged = [...projectRows(left.rows), ...projectRows(right.rows)];
  return {
    nodeId: node.id,
    title: node.title,
    columns,
    rows: node.data.unionMode === "union all" ? merged : dedupeRows(merged, columns),
    lineageText: `(${left.lineageText}) + (${right.lineageText}) -> ${node.title}`,
  };
};

const previewTransformNode = (node, upstream, resolver) => {
  const rules = ensureArray(node.data.rules).filter((rule) => rule.alias);
  const rows = cloneRows(upstream.rows).map((row) => {
    const nextRow = { ...row };
    for (const rule of rules) {
      nextRow[rule.alias] = resolver(row, rule);
    }
    return nextRow;
  });
  return {
    nodeId: node.id,
    title: node.title,
    columns: [...upstream.columns, ...rules.map((rule) => ({ name: rule.alias, label: rule.label || rule.alias }))],
    rows,
    lineageText: wrapLineage(upstream.lineageText, node.title),
  };
};

const previewOrderNode = (node, upstream) => {
  const orders = ensureArray(node.data.orders).filter((item) => item.column);
  let rows = [...upstream.rows];
  if (orders.length > 0) {
    rows = [...rows].sort((left, right) => {
      for (const item of orders) {
        const name = stripQualifier(item.column);
        const leftValue = toComparableValue(left[name]);
        const rightValue = toComparableValue(right[name]);
        if (leftValue === rightValue) {
          continue;
        }
        const compare = leftValue > rightValue ? 1 : -1;
        return item.direction === "desc" ? -compare : compare;
      }
      return 0;
    });
  }
  const limit = Number(node.data.limit) || 0;
  if (limit > 0) {
    rows = rows.slice(0, limit);
  }
  return {
    nodeId: node.id,
    title: node.title,
    columns: upstream.columns,
    rows,
    lineageText: wrapLineage(upstream.lineageText, node.title),
  };
};

const previewPartitionOrderNode = (node, upstream) => {
  const partitionColumns = ensureArray(node.data.partitions).map((column) => stripQualifier(column));
  const orderColumns = ensureArray(node.data.orders).filter((item) => item.column);
  const topN = Number(node.data.topN) || 1;
  const groups = new Map();

  for (const row of upstream.rows) {
    const key = JSON.stringify(partitionColumns.map((column) => row[column]));
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  }

  const rows = [...groups.values()].flatMap((groupRows) =>
    [...groupRows]
      .sort((left, right) => {
        for (const item of orderColumns) {
          const name = stripQualifier(item.column);
          const leftValue = toComparableValue(left[name]);
          const rightValue = toComparableValue(right[name]);
          if (leftValue === rightValue) {
            continue;
          }
          const compare = leftValue > rightValue ? 1 : -1;
          return item.direction === "desc" ? -compare : compare;
        }
        return 0;
      })
      .slice(0, topN)
      .map((row, index) => ({
        ...row,
        [node.data.rankAlias || "fzxh_rank"]: index + 1,
      }))
  );

  const rankAlias = node.data.rankAlias || "fzxh_rank";
  return {
    nodeId: node.id,
    title: node.title,
    columns: [...upstream.columns, { name: rankAlias, label: rankAlias }],
    rows,
    lineageText: wrapLineage(upstream.lineageText, node.title),
  };
};

const previewDistinctNode = (node, upstream) => {
  const distinctColumns = ensureArray(node.data.distinctColumns);
  const columns =
    distinctColumns.length > 0
      ? upstream.columns.filter((column) => distinctColumns.includes(column.name))
      : upstream.columns;
  const rows = dedupeRows(
    upstream.rows.map((row) => Object.fromEntries(columns.map((column) => [column.name, row[stripQualifier(column.name)] ?? null]))),
    columns
  );
  return {
    nodeId: node.id,
    title: node.title,
    columns,
    rows,
    lineageText: wrapLineage(upstream.lineageText, node.title),
  };
};

const previewOutputNode = (node, upstream) => {
  const selected = ensureArray(node.data.selectedColumns);
  const aliases = node.data.aliases || {};
  const columns =
    selected.length > 0 ? upstream.columns.filter((column) => selected.includes(column.name)) : upstream.columns;
  const nextColumns = columns.map((column) => ({
    name: aliases[column.name] || column.name,
    label: aliases[column.name] || column.label,
    sourceName: column.name,
  }));
  const rows = upstream.rows.map((row) =>
    Object.fromEntries(nextColumns.map((column) => [column.name, row[stripQualifier(column.sourceName)] ?? null]))
  );
  return {
    nodeId: node.id,
    title: node.title,
    outputTable: node.data.outputTable,
    columns: nextColumns.map(({ sourceName, ...column }) => column),
    rows,
    lineageText: wrapLineage(upstream.lineageText, node.title),
  };
};

export const previewNodeData = (graph, nodeId, options = {}) => {
  const context = createPreviewContext(graph, options);
  const result = compilePreviewInternal(context, nodeId);
  return {
    ...result,
    rowCount: result.rows.length,
    previewRows: result.rows.slice(0, 20),
  };
};
