/**
 * @author: zhjj
 */
const operatorGroups = [
  {
    key: "data_process",
    label: "数据处理算子",
    items: [
      { category: "bgl_", label: "关联", description: "按条件关联左右分支结果。", arity: 2, tone: "operator" },
      { category: "bsc_", label: "输出表", description: "定义最终输出表名和列别名。", arity: 1, tone: "accent" },
      { category: "hgl_", label: "过滤", description: "配置 where 条件并追加过滤。", arity: 1, tone: "operator" },
      { category: "bfz_", label: "分组", description: "配置 group by、聚合和 having。", arity: 1, tone: "operator" },
      { category: "bbj_", label: "并集", description: "按列对齐两条支路后做 union。", arity: 2, tone: "operator" },
      { category: "substr_", label: "字符串截取", description: "生成 substr/substring 列。", arity: 1, tone: "operator" },
      { category: "replace_", label: "字符串替换", description: "生成 replace 列。", arity: 1, tone: "operator" },
      { category: "concat_", label: "字符串拼接", description: "拼接多个列成为新列。", arity: 1, tone: "operator" },
      { category: "convert_", label: "类型转换", description: "字符和数字之间转换。", arity: 1, tone: "operator" },
      { category: "order_", label: "排序", description: "配置排序和 top/limit。", arity: 1, tone: "operator" },
      { category: "partitionOrder_", label: "分组排序", description: "按 partition + row_number 留前 N。", arity: 1, tone: "operator" },
      { category: "hzl_", label: "行转列", description: "按 group_concat/listagg 做行转列聚合。", arity: 1, tone: "operator" },
      { category: "removeRepeat_", label: "去重", description: "按列去重并保留唯一组合。", arity: 1, tone: "operator" },
      { category: "newColumn_", label: "新增列", description: "用表达式生成额外列。", arity: 1, tone: "operator" },
    ],
  },
];

export const operatorMap = Object.fromEntries(
  operatorGroups.flatMap((group) => group.items.map((item) => [item.category, item]))
);

export const sqlOperatorGroups = operatorGroups;

const createBase = (category, overrides = {}) => ({
  selectedColumns: [],
  extraColumns: [],
  ...overrides,
  category,
});

export const createOperatorConfig = (category) => {
  switch (category) {
    case "hgl_":
      return createBase(category, {
        conditions: [
          { id: "cond-1", column: "", operator: "equal", value: "", valueType: "literal" },
        ],
        conditionLogic: "and",
        extraWhere: "",
      });
    case "bfz_":
      return createBase(category, {
        groupBys: [],
        aggregates: [
          {
            id: "agg-1",
            func: "sum",
            column: "",
            alias: "metric_total",
            label: "指标汇总",
            havingOperator: "",
            havingValue: "",
          },
        ],
      });
    case "hzl_":
      return createBase(category, {
        groupBys: [],
        pivotColumns: [
          {
            id: "pivot-1",
            sourceColumn: "",
            orderColumn: "",
            alias: "pivot_values",
            label: "行转列结果",
          },
        ],
      });
    case "bgl_":
      return createBase(category, {
        joinType: "inner join",
        conditions: [{ id: "join-1", leftColumn: "", operator: "equal", rightColumn: "" }],
        distinct: true,
        outputMode: "all",
        selectedColumns: [],
      });
    case "bbj_":
      return createBase(category, {
        unionMode: "union",
        selectedColumns: [],
      });
    case "substr_":
      return createBase(category, {
        rules: [{ id: "substr-1", sourceColumn: "", start: 1, length: 7, alias: "month_key", label: "月份字段" }],
      });
    case "replace_":
      return createBase(category, {
        rules: [{ id: "replace-1", sourceColumn: "", from: "", to: "", alias: "replaced_col", label: "替换字段" }],
      });
    case "concat_":
      return createBase(category, {
        rules: [{ id: "concat-1", sourceColumns: [], separator: "-", alias: "concat_col", label: "拼接字段" }],
      });
    case "convert_":
      return createBase(category, {
        rules: [{ id: "convert-1", sourceColumn: "", mode: "charToNumeric", alias: "converted_col", label: "转换字段" }],
      });
    case "order_":
      return createBase(category, {
        orders: [{ id: "order-1", column: "", direction: "desc" }],
        limit: 10,
      });
    case "partitionOrder_":
      return createBase(category, {
        partitions: [],
        orders: [{ id: "partition-order-1", column: "", direction: "desc" }],
        topN: 1,
        rankAlias: "fzxh_rank",
      });
    case "removeRepeat_":
      return createBase(category, {
        distinctColumns: [],
      });
    case "newColumn_":
      return createBase(category, {
        rules: [{ id: "newcol-1", alias: "new_field", expression: "", label: "新增字段" }],
      });
    case "bsc_":
      return createBase(category, {
        outputTable: "self_owned.result_table",
        outputLabel: "输出结果表",
        selectedColumns: [],
        aliases: {},
      });
    default:
      return createBase(category);
  }
};

export const unaryCategories = new Set([
  "hgl_",
  "bfz_",
  "hzl_",
  "substr_",
  "replace_",
  "concat_",
  "convert_",
  "order_",
  "partitionOrder_",
  "removeRepeat_",
  "newColumn_",
  "bsc_",
]);

export const binaryCategories = new Set(["bgl_", "bbj_"]);
