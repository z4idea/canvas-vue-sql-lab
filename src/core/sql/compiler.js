/**
 * @author: zhjj
 */
import { byId, getIncomingEdges, getIncomingMap, getRequiredInputHandles } from "../graph/graphUtils.js";
import { getDatasetById } from "../catalog/datasets.js";

const stripQualifier = (name) => {
  if (!name) {
    return name;
  }
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1) : name;
};

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;

const defaultAlias = (node) => `tab_${node.id.replace(/[^A-Za-z0-9]+/g, "_")}`;

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const normalizeBinaryInputs = (graph, node) => {
  const incoming = getIncomingEdges(graph.edges, node.id);
  const byHandle = getIncomingMap(graph.edges, node.id);
  const leftSource = byHandle.left || incoming[0]?.sourceId;
  const rightSource = byHandle.right || incoming[1]?.sourceId;
  return { leftSource, rightSource };
};

const compileColumnsProjection = (columns) =>
  columns.map((column) => ({
    name: column.name,
    label: column.label || column.name,
  }));

const aggregateSql = (func, expression, dialect) => {
  if (func === "avg") {
    return dialect === "sqlserver"
      ? `cast(round(avg(${expression}), 2) as numeric(20, 2))`
      : `round(avg(${expression}), 2)`;
  }
  if (func === "distinctCount") {
    return `count(distinct ${expression})`;
  }
  return `${func}(${expression})`;
};

const filterOperatorSql = (operator) =>
  ({
    equal: "=",
    notEqual: "<>",
    greaterThan: ">",
    greaterThanEqual: ">=",
    lessThan: "<",
    lessThanEqual: "<=",
    like: "like",
    notLike: "not like",
    beginsWith: "like",
    endsWith: "like",
    isNull: "is null",
    isNotNull: "is not null",
  })[operator] || "=";

const convertExpression = (mode, sourceColumn, dialect) => {
  if (mode === "charToNumeric") {
    if (dialect === "postgresql") {
      return `to_number(${sourceColumn}, '99999999999999999999.99')`;
    }
    if (dialect === "oracle") {
      return `to_number(${sourceColumn})`;
    }
    return `${sourceColumn} + 0`;
  }
  if (mode === "numericToChar") {
    if (dialect === "oracle") {
      return `to_char(${sourceColumn})`;
    }
    return `cast(${sourceColumn} as char)`;
  }
  return sourceColumn;
};

const buildConcatExpression = (sourceColumns, separator, dialect) => {
  const names = sourceColumns.map((column) => stripQualifier(column));
  if (dialect === "oracle") {
    return names.join(` || '${separator}' || `);
  }
  if (dialect === "sqlserver") {
    return names.join(` + '${separator}' + `);
  }
  return `concat_ws('${separator}', ${names.join(", ")})`;
};

const buildLikeClause = (column, literal, mode, dialect) => {
  if (dialect === "oracle" || dialect === "postgresql") {
    if (mode === "contains") {
      return `${column} like '%' || ${literal} || '%'`;
    }
    if (mode === "beginsWith") {
      return `${column} like ${literal} || '%'`;
    }
    return `${column} like '%' || ${literal}`;
  }
  if (mode === "contains") {
    return `${column} like concat('%', ${literal}, '%')`;
  }
  if (mode === "beginsWith") {
    return `${column} like concat(${literal}, '%')`;
  }
  return `${column} like concat('%', ${literal})`;
};

const buildFilterClause = (conditions, logic, dialect) => {
  const normalized = ensureArray(conditions)
    .filter((condition) => condition.column)
    .map((condition) => {
      const column = stripQualifier(condition.column);
      const operatorSql = filterOperatorSql(condition.operator);
      if (operatorSql.includes("null")) {
        return `${column} ${operatorSql}`;
      }
      const literal = condition.valueType === "expression" ? condition.value : quote(condition.value ?? "");
      if (condition.operator === "like") {
        return buildLikeClause(column, literal, "contains", dialect);
      }
      if (condition.operator === "beginsWith") {
        return buildLikeClause(column, literal, "beginsWith", dialect);
      }
      if (condition.operator === "endsWith") {
        return buildLikeClause(column, literal, "endsWith", dialect);
      }
      if (condition.operator === "notLike") {
        return buildLikeClause(column, literal, "contains", dialect).replace(" like ", " not like ");
      }
      return `${column} ${operatorSql} ${literal}`;
    });

  if (normalized.length === 0) {
    return "1 = 1";
  }
  return normalized.join(` ${logic || "and"} `);
};

const unionCommonColumns = (leftColumns, rightColumns) => {
  const rightNames = new Set(rightColumns.map((column) => column.name));
  return leftColumns.filter((column) => rightNames.has(column.name));
};

const createCompilerContext = (graph, options = {}) => ({
  graph,
  nodeMap: byId(graph.nodes),
  cache: new Map(),
  dialect: options.dialect || "mysql",
});

const compileNodeInternal = (context, nodeId) => {
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

  let result;
  if (node.kind === "dataset") {
    result = compileSourceNode(context, node);
  } else {
    result = compileOperatorNode(context, node);
  }
  context.cache.set(nodeId, result);
  return result;
};

const compileSourceNode = (context, node) => {
  const dataset = getDatasetById(node.data.datasetId);
  if (!dataset) {
    throw new Error(`数据集不存在: ${node.data.datasetId}`);
  }

  const selectedNames = ensureArray(node.data.selectedColumns);
  const baseColumns = dataset.columns
    .filter((column) => selectedNames.length === 0 || selectedNames.includes(column.name))
    .map((column) => ({
      name: stripQualifier(column.name),
      label: column.label,
    }));

  const extraColumns = ensureArray(node.data.extraColumns)
    .filter((item) => item.alias && item.expression)
    .map((item) => ({
      name: item.alias,
      label: item.label || item.alias,
      expression: item.expression,
    }));

  const selectSql = [
    ...baseColumns.map((column) => stripQualifier(column.name)),
    ...extraColumns.map((column) => `${column.expression} as ${column.name}`),
  ];

  return {
    nodeId: node.id,
    sql: `select ${selectSql.join(", ")} from ${dataset.schema}.${dataset.table}`,
    alias: defaultAlias(node),
    columns: compileColumnsProjection([...baseColumns, ...extraColumns]),
  };
};

const compileOperatorNode = (context, node) => {
  const compileUnary = () => {
    const sourceId = getIncomingMap(context.graph.edges, node.id).in;
    return compileNodeInternal(context, sourceId);
  };

  switch (node.category) {
    case "hgl_":
      return compileFilterNode(context, node, compileUnary());
    case "newColumn_":
      return compileNewColumnNode(context, node, compileUnary());
    case "bfz_":
      return compileGroupByNode(context, node, compileUnary());
    case "hzl_":
      return compilePivotAggregateNode(context, node, compileUnary());
    case "bgl_":
      return compileJoinNode(context, node);
    case "bbj_":
      return compileUnionNode(context, node);
    case "substr_":
      return compileSubstringNode(context, node, compileUnary());
    case "replace_":
      return compileReplaceNode(context, node, compileUnary());
    case "concat_":
      return compileConcatNode(context, node, compileUnary());
    case "convert_":
      return compileConvertNode(context, node, compileUnary());
    case "order_":
      return compileOrderNode(context, node, compileUnary());
    case "partitionOrder_":
      return compilePartitionOrderNode(context, node, compileUnary());
    case "removeRepeat_":
      return compileDistinctNode(context, node, compileUnary());
    case "bsc_":
      return compileOutputNode(context, node, compileUnary());
    default:
      throw new Error(`暂不支持的算子: ${node.category}`);
  }
};

const wrapSql = (result, node) => `(${result.sql}) ${defaultAlias(node)}`;

const compileFilterNode = (context, node, upstream) => {
  const clause = buildFilterClause(node.data.conditions, node.data.conditionLogic, context.dialect);
  const extraWhere = (node.data.extraWhere || "").trim();
  const whereSql = extraWhere ? `(${clause}) ${node.data.conditionLogic || "and"} ${extraWhere}` : clause;
  return {
    nodeId: node.id,
    alias: defaultAlias(node),
    columns: upstream.columns,
    sql: `select * from ${wrapSql(upstream, node)} where ${whereSql}`,
  };
};

const compileNewColumnNode = (context, node, upstream) => {
  const rules = ensureArray(node.data.rules).filter((rule) => rule.alias && rule.expression);
  const selectSql = [
    ...upstream.columns.map((column) => stripQualifier(column.name)),
    ...rules.map((rule) => `${rule.expression} as ${rule.alias}`),
  ];
  return {
    nodeId: node.id,
    alias: defaultAlias(node),
    columns: [
      ...upstream.columns,
      ...rules.map((rule) => ({ name: rule.alias, label: rule.label || rule.alias })),
    ],
    sql: `select ${selectSql.join(", ")} from ${wrapSql(upstream, node)}`,
  };
};

const compileGroupByNode = (context, node, upstream) => {
  const groupBys = ensureArray(node.data.groupBys);
  const aggregates = ensureArray(node.data.aggregates).filter((item) => item.column && item.alias);
  const groupExpressions = groupBys.map((column) => stripQualifier(column));
  const aggregateExpressions = aggregates.map((aggregate) => {
    const expression = aggregateSql(aggregate.func, stripQualifier(aggregate.column), context.dialect);
    return { ...aggregate, expression };
  });
  const selectSql = [
    ...groupExpressions,
    ...aggregateExpressions.map((aggregate) => `${aggregate.expression} as ${aggregate.alias}`),
  ];
  const havingSql = aggregateExpressions
    .filter((aggregate) => aggregate.havingOperator && aggregate.havingValue !== "")
    .map((aggregate) => `${aggregate.expression} ${aggregate.havingOperator} ${aggregate.havingValue}`)
    .join(" and ");

  return {
    nodeId: node.id,
    alias: defaultAlias(node),
    columns: [
      ...groupBys.map((column) => ({
        name: stripQualifier(column),
        label: stripQualifier(column),
      })),
      ...aggregates.map((aggregate) => ({
        name: aggregate.alias,
        label: aggregate.label || aggregate.alias,
      })),
    ],
    sql: [
      `select ${selectSql.join(", ")} from ${wrapSql(upstream, node)}`,
      groupExpressions.length > 0 ? `group by ${groupExpressions.join(", ")}` : "",
      havingSql ? `having ${havingSql}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
};

const compilePivotAggregateNode = (context, node, upstream) => {
  const groupBys = ensureArray(node.data.groupBys).map((column) => stripQualifier(column));
  const pivotColumns = ensureArray(node.data.pivotColumns).filter(
    (column) => column.sourceColumn && column.orderColumn && column.alias
  );

  const aggregateExpressions = pivotColumns.map((column) => {
    const source = stripQualifier(column.sourceColumn);
    const order = stripQualifier(column.orderColumn);
    const expression =
      context.dialect === "postgresql"
        ? `string_agg(${source}, ',' order by ${order})`
        : `group_concat(${source} order by ${order} separator ',')`;
    return { ...column, expression };
  });

  const selectSql = [
    ...groupBys,
    ...aggregateExpressions.map((column) => `${column.expression} as ${column.alias}`),
  ];

  return {
    nodeId: node.id,
    alias: defaultAlias(node),
    columns: [
      ...groupBys.map((column) => ({ name: column, label: column })),
      ...aggregateExpressions.map((column) => ({
        name: column.alias,
        label: column.label || column.alias,
      })),
    ],
    sql: [
      `select ${selectSql.join(", ")} from ${wrapSql(upstream, node)}`,
      groupBys.length > 0 ? `group by ${groupBys.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
};

const compileJoinNode = (context, node) => {
  const { leftSource, rightSource } = normalizeBinaryInputs(context.graph, node);
  const left = compileNodeInternal(context, leftSource);
  const right = compileNodeInternal(context, rightSource);
  const leftAlias = `l_${node.id.replace(/[^A-Za-z0-9]+/g, "_")}`;
  const rightAlias = `r_${node.id.replace(/[^A-Za-z0-9]+/g, "_")}`;
  const conditions = ensureArray(node.data.conditions).filter((item) => item.leftColumn && item.rightColumn);
  const onClause =
    conditions.length > 0
      ? conditions
          .map(
            (condition) =>
              `${leftAlias}.${stripQualifier(condition.leftColumn)} ${filterOperatorSql(condition.operator)} ${rightAlias}.${stripQualifier(condition.rightColumn)}`
          )
          .join(" and ")
      : "1 = 1";

  let columns;
  let selectSql;
  if (ensureArray(node.data.selectedColumns).length > 0) {
    columns = ensureArray(node.data.selectedColumns).map((item) => ({
      name: item.alias || item.name,
      label: item.label || item.alias || item.name,
      side: item.side,
      sourceName: item.name,
    }));
  } else {
    const leftColumns = left.columns.map((column) => ({
      name: column.name,
      label: column.label,
      side: "left",
      sourceName: column.name,
    }));
    const rightSeen = new Set(leftColumns.map((column) => column.name));
    const rightColumns = right.columns.map((column) => ({
      name: rightSeen.has(column.name) ? `${column.name}_right` : column.name,
      label: rightSeen.has(column.name) ? `${column.label} (右)` : column.label,
      side: "right",
      sourceName: column.name,
    }));
    columns = [...leftColumns, ...rightColumns];
  }

  selectSql = columns.map((column) => {
    const tableAlias = column.side === "right" ? rightAlias : leftAlias;
    const sourceName = stripQualifier(column.sourceName || column.name);
    return column.name === sourceName ? `${tableAlias}.${sourceName}` : `${tableAlias}.${sourceName} as ${column.name}`;
  });

  const sql = `select ${selectSql.join(", ")} from (${left.sql}) ${leftAlias} ${node.data.joinType || "inner join"} (${right.sql}) ${rightAlias} on ${onClause}`;

  return {
    nodeId: node.id,
    alias: defaultAlias(node),
    columns: columns.map((column) => ({ name: column.name, label: column.label })),
    sql:
      node.data.distinct === false
        ? sql
        : `select ${columns.map((column) => column.name).join(", ")} from (${sql}) ${defaultAlias(node)} group by ${columns
            .map((column) => column.name)
            .join(", ")}`,
  };
};

const compileUnionNode = (context, node) => {
  const { leftSource, rightSource } = normalizeBinaryInputs(context.graph, node);
  const left = compileNodeInternal(context, leftSource);
  const right = compileNodeInternal(context, rightSource);
  const selected = ensureArray(node.data.selectedColumns);
  const columns =
    selected.length > 0
      ? selected.map((column) => ({ name: column.name, label: column.label || column.name }))
      : unionCommonColumns(left.columns, right.columns);
  if (columns.length === 0) {
    throw new Error("并集算子没有找到可对齐的公共列。");
  }
  const projection = columns.map((column) => stripQualifier(column.name)).join(", ");
  return {
    nodeId: node.id,
    alias: defaultAlias(node),
    columns,
    sql: `select ${projection} from (${left.sql}) ${defaultAlias({ id: `${node.id}_left` })} ${
      node.data.unionMode || "union"
    } select ${projection} from (${right.sql}) ${defaultAlias({ id: `${node.id}_right` })}`,
  };
};

const compileTransformNode = (context, node, upstream, transformExpressions) => ({
  nodeId: node.id,
  alias: defaultAlias(node),
  columns: [
    ...upstream.columns,
    ...transformExpressions.map((item) => ({ name: item.alias, label: item.label || item.alias })),
  ],
  sql: `select ${[
    ...upstream.columns.map((column) => stripQualifier(column.name)),
    ...transformExpressions.map((item) => `${item.expression} as ${item.alias}`),
  ].join(", ")} from ${wrapSql(upstream, node)}`,
});

const compileSubstringNode = (context, node, upstream) =>
  compileTransformNode(
    context,
    node,
    upstream,
    ensureArray(node.data.rules)
      .filter((rule) => rule.sourceColumn && rule.alias)
      .map((rule) => ({
        ...rule,
        expression:
          context.dialect === "sqlserver"
            ? `substring(${stripQualifier(rule.sourceColumn)}, ${rule.start}, ${rule.length})`
            : `substr(${stripQualifier(rule.sourceColumn)}, ${rule.start}, ${rule.length})`,
      }))
  );

const compileReplaceNode = (context, node, upstream) =>
  compileTransformNode(
    context,
    node,
    upstream,
    ensureArray(node.data.rules)
      .filter((rule) => rule.sourceColumn && rule.alias)
      .map((rule) => ({
        ...rule,
        expression: `replace(${stripQualifier(rule.sourceColumn)}, ${quote(rule.from || "")}, ${quote(rule.to || "")})`,
      }))
  );

const compileConcatNode = (context, node, upstream) =>
  compileTransformNode(
    context,
    node,
    upstream,
    ensureArray(node.data.rules)
      .filter((rule) => ensureArray(rule.sourceColumns).length > 0 && rule.alias)
      .map((rule) => ({
        ...rule,
        expression: buildConcatExpression(rule.sourceColumns, rule.separator || "-", context.dialect),
      }))
  );

const compileConvertNode = (context, node, upstream) =>
  compileTransformNode(
    context,
    node,
    upstream,
    ensureArray(node.data.rules)
      .filter((rule) => rule.sourceColumn && rule.alias)
      .map((rule) => ({
        ...rule,
        expression: convertExpression(rule.mode, stripQualifier(rule.sourceColumn), context.dialect),
      }))
  );

const compileOrderNode = (context, node, upstream) => {
  const orders = ensureArray(node.data.orders).filter((item) => item.column);
  const orderSql = orders.length > 0 ? ` order by ${orders.map((item) => `${stripQualifier(item.column)} ${item.direction || "asc"}`).join(", ")}` : "";
  const normalizedLimit = Number(node.data.limit) || 0;
  const limitSql =
    normalizedLimit > 0
      ? context.dialect === "sqlserver"
        ? ""
        : context.dialect === "oracle"
          ? ` fetch first ${normalizedLimit} rows only`
          : ` limit ${normalizedLimit}`
      : "";
  const projection = normalizedLimit > 0 && context.dialect === "sqlserver" ? `top ${normalizedLimit} *` : "*";
  return {
    nodeId: node.id,
    alias: defaultAlias(node),
    columns: upstream.columns,
    sql: `select ${projection} from ${wrapSql(upstream, node)}${orderSql}${limitSql}`,
  };
};

const compilePartitionOrderNode = (context, node, upstream) => {
  const partitions = ensureArray(node.data.partitions).map((column) => stripQualifier(column));
  const orders = ensureArray(node.data.orders)
    .filter((item) => item.column)
    .map((item) => `${stripQualifier(item.column)} ${item.direction || "desc"}`);
  const rankAlias = node.data.rankAlias || "partition_rank";
  const rowNumberSql = `row_number() over (partition by ${partitions.join(", ")} order by ${orders.join(", ")}) as ${rankAlias}`;
  return {
    nodeId: node.id,
    alias: defaultAlias(node),
    columns: upstream.columns,
    sql: `select * from (select ${upstream.columns
      .map((column) => stripQualifier(column.name))
      .join(", ")}, ${rowNumberSql} from ${wrapSql(upstream, node)}) ${defaultAlias(node)} where ${rankAlias} <= ${
      Number(node.data.topN) || 1
    }`,
  };
};

const compileDistinctNode = (context, node, upstream) => {
  const distinctColumns = ensureArray(node.data.distinctColumns);
  const columns =
    distinctColumns.length > 0
      ? upstream.columns.filter((column) => distinctColumns.includes(column.name))
      : upstream.columns;
  return {
    nodeId: node.id,
    alias: defaultAlias(node),
    columns,
    sql: `select ${columns.map((column) => stripQualifier(column.name)).join(", ")} from ${wrapSql(upstream, node)} group by ${columns
      .map((column) => stripQualifier(column.name))
      .join(", ")}`,
  };
};

const compileOutputNode = (context, node, upstream) => {
  const selected = ensureArray(node.data.selectedColumns);
  const aliases = node.data.aliases || {};
  const columns =
    selected.length > 0 ? upstream.columns.filter((column) => selected.includes(column.name)) : upstream.columns;
  const selectSql = columns.map((column) => {
    const targetName = aliases[column.name] || column.name;
    return targetName === column.name ? stripQualifier(column.name) : `${stripQualifier(column.name)} as ${targetName}`;
  });
  return {
    nodeId: node.id,
    alias: defaultAlias(node),
    outputTable: node.data.outputTable,
    columns: columns.map((column) => ({
      name: aliases[column.name] || column.name,
      label: aliases[column.name] || column.label,
    })),
    sql: `select ${selectSql.join(", ")} from ${wrapSql(upstream, node)}`,
  };
};

export const compileNode = (graph, nodeId, options = {}) => compileNodeInternal(createCompilerContext(graph, options), nodeId);

export const compileGraph = (graph, outputNodeId, options = {}) => {
  const context = createCompilerContext(graph, options);
  const result = compileNodeInternal(context, outputNodeId);
  return {
    ...result,
    cache: context.cache,
  };
};

export const analyzeAvailableColumns = (graph, nodeId, options = {}) => {
  const nodeMap = byId(graph.nodes);
  const node = nodeMap[nodeId];
  if (!node) {
    return { primary: [], left: [], right: [] };
  }
  const context = createCompilerContext(graph, options);
  if (node.kind === "dataset") {
    const result = compileNodeInternal(context, nodeId);
    return { primary: result.columns, left: [], right: [] };
  }
  if (node.category === "bgl_" || node.category === "bbj_") {
    const { leftSource, rightSource } = normalizeBinaryInputs(context.graph, node);
    return {
      primary: [],
      left: leftSource ? compileNodeInternal(context, leftSource).columns : [],
      right: rightSource ? compileNodeInternal(context, rightSource).columns : [],
    };
  }
  const sourceId = getIncomingMap(graph.edges, nodeId).in;
  return {
    primary: sourceId ? compileNodeInternal(context, sourceId).columns : [],
    left: [],
    right: [],
  };
};
