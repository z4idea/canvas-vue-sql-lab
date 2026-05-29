/**
 * @author: zhjj
 */
const ensureArray = (value) => (Array.isArray(value) ? value : []);

const stripQualifier = (name) => {
  if (!name) {
    return name;
  }
  const index = String(name).lastIndexOf(".");
  return index >= 0 ? String(name).slice(index + 1) : String(name);
};

const unionCommonColumns = (leftColumns, rightColumns) => {
  const rightNames = new Set(rightColumns.map((column) => column.name));
  return leftColumns.filter((column) => rightNames.has(column.name));
};

const projectJoinColumns = (node, left, right) => {
  const selected = ensureArray(node.data.selectedColumns);
  if (selected.length > 0) {
    return selected.map((item) => ({
      name: item.alias || item.name,
      label: item.label || item.alias || item.name,
    }));
  }
  const leftColumns = left.map((column) => ({
    name: column.name,
    label: column.label || column.name,
  }));
  const rightSeen = new Set(leftColumns.map((column) => column.name));
  const rightColumns = right.map((column) => ({
    name: rightSeen.has(column.name) ? `${column.name}_right` : column.name,
    label: rightSeen.has(column.name) ? `${column.label || column.name} (右)` : column.label || column.name,
  }));
  return [...leftColumns, ...rightColumns];
};

/**
 * Derive the output column list for UI previews from node config and upstream columns.
 * This is intentionally more lenient than SQL compilation so partially filled forms still preview.
 */
export const projectNodeOutputColumns = (node, upstream = {}) => {
  if (!node) {
    return [];
  }

  const primary = ensureArray(upstream.primary);
  const left = ensureArray(upstream.left);
  const right = ensureArray(upstream.right);

  if (node.kind === "dataset") {
    const selected = ensureArray(node.data.selectedColumns);
    const base = ensureArray(node.data.columns)
      .filter((column) => selected.length === 0 || selected.includes(column.name))
      .map((column) => ({
        name: stripQualifier(column.name),
        label: column.label || column.name,
      }));
    const extra = ensureArray(node.data.extraColumns)
      .filter((item) => item.alias)
      .map((item) => ({
        name: item.alias,
        label: item.label || item.alias,
      }));
    return [...base, ...extra];
  }

  switch (node.category) {
    case "hgl_":
    case "order_":
      return primary;
    case "removeRepeat_": {
      const distinctColumns = ensureArray(node.data.distinctColumns);
      return distinctColumns.length > 0
        ? primary.filter((column) => distinctColumns.includes(column.name))
        : primary;
    }
    case "newColumn_": {
      const rules = ensureArray(node.data.rules).filter((rule) => rule.alias);
      return [...primary, ...rules.map((rule) => ({ name: rule.alias, label: rule.label || rule.alias }))];
    }
    case "bfz_": {
      const groupBys = ensureArray(node.data.groupBys);
      const aggregates = ensureArray(node.data.aggregates).filter((item) => item.alias);
      return [
        ...groupBys.map((column) => ({
          name: stripQualifier(column),
          label: stripQualifier(column),
        })),
        ...aggregates.map((aggregate) => ({
          name: aggregate.alias,
          label: aggregate.label || aggregate.alias,
        })),
      ];
    }
    case "hzl_": {
      const groupBys = ensureArray(node.data.groupBys).map((column) => stripQualifier(column));
      const pivotColumns = ensureArray(node.data.pivotColumns).filter((item) => item.alias);
      return [
        ...groupBys.map((column) => ({ name: column, label: column })),
        ...pivotColumns.map((column) => ({
          name: column.alias,
          label: column.label || column.alias,
        })),
      ];
    }
    case "bgl_":
      return projectJoinColumns(node, left, right);
    case "bbj_": {
      const selected = ensureArray(node.data.selectedColumns);
      return selected.length > 0
        ? selected.map((column) => ({
            name: column.name,
            label: column.label || column.name,
          }))
        : unionCommonColumns(left, right);
    }
    case "substr_":
    case "replace_":
    case "concat_":
    case "convert_": {
      const rules = ensureArray(node.data.rules).filter((rule) => rule.alias);
      return [...primary, ...rules.map((rule) => ({ name: rule.alias, label: rule.label || rule.alias }))];
    }
    case "partitionOrder_": {
      const rankAlias = node.data.rankAlias || "fzxh_rank";
      return [...primary, { name: rankAlias, label: rankAlias }];
    }
    case "bsc_": {
      const selected = ensureArray(node.data.selectedColumns);
      return selected.length > 0
        ? primary.filter((column) => selected.includes(column.name))
        : primary;
    }
    default:
      return primary;
  }
};
