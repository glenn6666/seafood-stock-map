-- 10/31 盤點商品補上後台儲位（只更新 id LIKE 'stk1031-%'）。依 display_units.area：f*→01、c*→04、t*→06、s7→07。
UPDATE inventory SET zone='01',photo_id='photo-1',fridge_id='01-left'   WHERE id LIKE 'stk1031-%' AND display_zone='f1';
UPDATE inventory SET zone='01',photo_id='photo-1',fridge_id='01-middle' WHERE id LIKE 'stk1031-%' AND display_zone='f2';
UPDATE inventory SET zone='01',photo_id='photo-1',fridge_id='01-right'  WHERE id LIKE 'stk1031-%' AND display_zone='f3';
UPDATE inventory SET zone='04',photo_id='photo-5',fridge_id=''          WHERE id LIKE 'stk1031-%' AND display_zone IN ('c1','c2','c3');
UPDATE inventory SET zone='06',photo_id='photo-7',fridge_id=''          WHERE id LIKE 'stk1031-%' AND display_zone IN ('t1','t7');
UPDATE inventory SET zone='07',photo_id='photo-3',fridge_id=''          WHERE id LIKE 'stk1031-%' AND display_zone='s7';
