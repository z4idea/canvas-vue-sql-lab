-- @author: zhjj

create schema if not exists original;
create schema if not exists dm;

drop table if exists original.product_order;
create table original.product_order (
  order_id varchar(64),
  order_date date,
  product_id varchar(64),
  shop_id varchar(64),
  order_quantity decimal(18, 2),
  order_amount decimal(18, 2),
  dept_id varchar(64)
);

insert into original.product_order (
  order_id,
  order_date,
  product_id,
  shop_id,
  order_quantity,
  order_amount,
  dept_id
) values
  ('PO-001', '2026-01-12', 'P-001', 'S-001', 18, 360, '1001'),
  ('PO-002', '2026-01-19', 'P-002', 'S-003', 8, 136, '1001'),
  ('PO-003', '2026-02-03', 'P-001', 'S-002', 13, 286, '1002');

drop table if exists original.product_list;
create table original.product_list (
  product_id varchar(64),
  product_name varchar(128),
  type_name varchar(128),
  status varchar(32)
);

insert into original.product_list (
  product_id,
  product_name,
  type_name,
  status
) values
  ('P-001', '龙井', '绿茶', 'on'),
  ('P-002', '金骏眉', '红茶', 'on'),
  ('P-003', '普洱', '黑茶', 'off');

drop table if exists original.shop_profile;
create table original.shop_profile (
  shop_id varchar(64),
  shop_name varchar(128),
  city_name varchar(128),
  owner_name varchar(128)
);

insert into original.shop_profile (
  shop_id,
  shop_name,
  city_name,
  owner_name
) values
  ('S-001', '朝阳店', '北京', '李冉'),
  ('S-002', '徐汇店', '上海', '吴晨'),
  ('S-003', '天河店', '广州', '周雪');

drop table if exists dm.sales_target;
create table dm.sales_target (
  target_month varchar(32),
  product_id varchar(64),
  target_amount decimal(18, 2)
);

insert into dm.sales_target (
  target_month,
  product_id,
  target_amount
) values
  ('2026-01', 'P-001', 900),
  ('2026-01', 'P-002', 520),
  ('2026-02', 'P-001', 880);
