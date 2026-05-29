/**
 * @author: zhjj
 */
const datasetList = [
  {
    id: "original.product_order",
    schema: "original",
    table: "product_order",
    label: "产品订单",
    description: "订单事实表，用于演示新增列、过滤、分组和聚合。",
    columns: [
      { name: "order_id", label: "订单ID", type: "varchar" },
      { name: "order_date", label: "下单日期", type: "date" },
      { name: "product_id", label: "产品ID", type: "varchar" },
      { name: "shop_id", label: "门店ID", type: "varchar" },
      { name: "order_quantity", label: "下单数量", type: "numeric" },
      { name: "order_amount", label: "下单金额", type: "numeric" },
      { name: "dept_id", label: "组织ID", type: "varchar" },
    ],
    rows: [
      {
        order_id: "PO-001",
        order_date: "2026-01-12",
        product_id: "P-001",
        shop_id: "S-001",
        order_quantity: 18,
        order_amount: 360,
        dept_id: "1001",
      },
      {
        order_id: "PO-002",
        order_date: "2026-01-19",
        product_id: "P-002",
        shop_id: "S-003",
        order_quantity: 8,
        order_amount: 136,
        dept_id: "1001",
      },
      {
        order_id: "PO-003",
        order_date: "2026-02-03",
        product_id: "P-001",
        shop_id: "S-002",
        order_quantity: 13,
        order_amount: 286,
        dept_id: "1002",
      },
    ],
  },
  {
    id: "original.product_list",
    schema: "original",
    table: "product_list",
    label: "产品维表",
    description: "产品维度表，用于演示关联和输出列映射。",
    columns: [
      { name: "product_id", label: "产品ID", type: "varchar" },
      { name: "product_name", label: "产品名称", type: "varchar" },
      { name: "type_name", label: "产品分类", type: "varchar" },
      { name: "status", label: "状态", type: "varchar" },
    ],
    rows: [
      { product_id: "P-001", product_name: "龙井", type_name: "绿茶", status: "on" },
      { product_id: "P-002", product_name: "金骏眉", type_name: "红茶", status: "on" },
      { product_id: "P-003", product_name: "普洱", type_name: "黑茶", status: "off" },
    ],
  },
  {
    id: "original.shop_profile",
    schema: "original",
    table: "shop_profile",
    label: "门店维表",
    description: "门店维度表，用于演示二次关联和分组排序。",
    columns: [
      { name: "shop_id", label: "门店ID", type: "varchar" },
      { name: "shop_name", label: "门店名称", type: "varchar" },
      { name: "city_name", label: "城市", type: "varchar" },
      { name: "owner_name", label: "负责人", type: "varchar" },
    ],
    rows: [
      { shop_id: "S-001", shop_name: "朝阳店", city_name: "北京", owner_name: "李冉" },
      { shop_id: "S-002", shop_name: "徐汇店", city_name: "上海", owner_name: "吴晨" },
      { shop_id: "S-003", shop_name: "天河店", city_name: "广州", owner_name: "周雪" },
    ],
  },
  {
    id: "dm.sales_target",
    schema: "dm",
    table: "sales_target",
    label: "销售目标",
    description: "目标表，用于演示并集或输出落表命名。",
    columns: [
      { name: "target_month", label: "目标月份", type: "varchar" },
      { name: "product_id", label: "产品ID", type: "varchar" },
      { name: "target_amount", label: "目标金额", type: "numeric" },
    ],
    rows: [
      { target_month: "2026-01", product_id: "P-001", target_amount: 900 },
      { target_month: "2026-01", product_id: "P-002", target_amount: 520 },
      { target_month: "2026-02", product_id: "P-001", target_amount: 880 },
    ],
  },
];

export const datasetMap = Object.fromEntries(datasetList.map((item) => [item.id, item]));

export const datasetTree = Object.values(
  datasetList.reduce((accumulator, dataset) => {
    const existing = accumulator[dataset.schema] || {
      key: dataset.schema,
      label: dataset.schema,
      kind: "schema",
      children: [],
    };
    existing.children.push({
      key: dataset.id,
      label: dataset.label,
      kind: "dataset",
      description: dataset.description,
      payload: dataset,
    });
    accumulator[dataset.schema] = existing;
    return accumulator;
  }, {})
);

export const getDatasetById = (datasetId) => datasetMap[datasetId] || null;

export const cloneColumns = (columns) =>
  columns.map((column) => ({
    ...column,
  }));
