-- 商品照片（後台庫存＋顧客冷凍現貨／訂購頁顯示）。只新增欄位，不改既有資料。
-- 照片本體沿用 dine_photos 表（D1，同餐點照片做法），image_url 存 /api/public/dine-photos/<id>。
-- 此遷移先不要套用到遠端 D1，等使用者說「上線」再套用。
ALTER TABLE inventory ADD COLUMN image_url text NOT NULL DEFAULT '';
