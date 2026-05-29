<!-- @author: zhjj -->
# Canvas Vue SQL Lab

这是一个**单独新建**的 Vue 画布项目，不依赖 `restored-frontend` 运行，也不再尝试还原原来的 React 工程结构。

目标是基于打包产物提炼出来的思路，重做一版画布核心：

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

## 说明

这里的目标不是 100% 复刻原项目，而是把你关心的画布核心逻辑抽出来，用 Vue 重新落成一个可继续扩展的独立模块。
