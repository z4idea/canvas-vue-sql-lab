<!-- @author: zhjj -->
# Canvas Vue SQL Lab

核心：

- 左侧数据集树
- 左侧算子目录
- 中间节点拖拽、移动、连线编排
- 右侧节点配置
- 前端递归编译 SQL

当前实现范围：

- 硬编码数据集：`product_order`、`product_list`、`shop_profile`、`sales_target`
- 左侧可查看数据集样本行和字段，并一键加入画布
- SQL 类算子：`关联`、`输出表`、`过滤`、`分组`、`并集`、`字符串截取`、`字符串替换`、`字符串拼接`、`类型转换`、`排序`、`分组排序`、`行转列`、`去重`、`新增列`
- 编译方言：`mysql`、`postgresql`、`sqlserver`、`oracle`
- 内置一条演示链路：`订单 -> 新增 month -> 分组聚合 -> 关联产品维表 -> 输出表`
- 支持导出/导入整张画布 JSON，便于观察节点图和 SQL 结果的对应关系

## 运行

```powershell
cd D:\dc2\canvas-vue-sql-lab
npm install --cache D:\dc2\.npm-cache
npm run dev
```

默认地址：

```text
http://localhost:3210/
```

## 目录

- `src/core/catalog`
  数据集目录和算子目录。
- `src/core/graph`
  节点模板、边模板和图校验辅助。
- `src/core/sql`
  前端 SQL 编译器。
- `src/components`
  画布页面的核心组件。