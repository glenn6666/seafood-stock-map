-- 線上點餐：只新增欄位與菜單表，不改既有庫存／訂單資料。
-- 此遷移先不要套用到遠端 D1，等使用者說「上線」再一併套用。
ALTER TABLE orders ADD COLUMN channel text NOT NULL DEFAULT 'shop';
ALTER TABLE orders ADD COLUMN pickup_at text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS orders_channel ON orders(channel);

CREATE TABLE IF NOT EXISTS dine_menu (
  id text PRIMARY KEY NOT NULL,
  category text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price integer,                  -- NULL = 時價
  price_note text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '份',
  badges text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  sort integer NOT NULL DEFAULT 0,
  active integer NOT NULL DEFAULT 1
);

INSERT INTO dine_menu (id,category,name,description,price,price_note,unit,badges,image_url,sort,active) VALUES
('dine-porridge-crab','porridge','紅蟳海鮮粥','以上海鮮為大鮑魚2、滿滿蛤蜊、數隻白蝦、主食材',499,'','份','','/seafood-stock-map/dine/congee-crab.webp',10,1),
('dine-porridge-scallop','porridge','日本大干貝海鮮粥','以上海鮮為大鮑魚2、滿滿蛤蜊、數隻白蝦、主食材',499,'','份','','/seafood-stock-map/dine/congee-scallop.webp',20,1),
('dine-porridge-milkfish','porridge','大片虱目魚肚蛤蜊粥','虱目魚肚、大顆蛤蜊',240,'','份','hot','/seafood-stock-map/dine/porridge-milkfish.webp',30,1),
('dine-fish-sweetfish','fish','鹽烤母蛋蛋大香魚','',199,'','份','best','/seafood-stock-map/dine/fish-sweetfish.webp',40,1),
('dine-fish-baby','fish','鹽烤大隻午仔魚','',230,'','份','','/seafood-stock-map/dine/fish-baby.webp',50,1),
('dine-fish-milkfish','fish','鹽烤大片虱目魚肚','',195,'','份','best','/seafood-stock-map/dine/fish-milkfish.webp',60,1),
('dine-fish-hairtail','fish','鹽烤白帶魚卷','',209,'','份','','/seafood-stock-map/dine/fish-hairtail.webp',70,1),
('dine-fish-mackerel','fish','鹽烤大片挪威鯖魚','',139,'','份','best','/seafood-stock-map/dine/fish-mackerel.webp',80,1),
('dine-fish-kinmedai','fish','火烤喜知次一夜干','',189,'','份','','/seafood-stock-map/dine/fish-kinmedai.webp',90,1),
('dine-steam-oyster','steam','日本生蠔三顆','附芥末醬油＋檸檬',197,'','份','','/seafood-stock-map/dine/oysters-hi.webp',100,1),
('dine-steam-mala','steam','麻辣小龍蝦','',349,'','份','','/seafood-stock-map/dine/crayfish-mala.webp',110,1),
('dine-steam-garlic','steam','蒜味小龍蝦','',349,'','份','','/seafood-stock-map/dine/crayfish-garlic.webp',120,1),
('dine-soup-milkfish','soup','大片虱目魚肚蛤蜊湯','',220,'','份','','/seafood-stock-map/dine/soup-milkfish.webp',130,1),
('dine-soup-wine','soup','酒煮蛤蜊','蛤蜊足一斤份，當日蛤蜊價＋80元',NULL,'當日蛤蜊價＋80元','份','','/seafood-stock-map/dine/soup-wine.webp',140,1),
('dine-soup-ginger','soup','薑絲蛤蜊湯','蛤蜊足一斤份，當日蛤蜊價＋50元',NULL,'當日蛤蜊價＋50元','份','','/seafood-stock-map/dine/soup-ginger.webp',150,1),
('dine-grill-giant','grill','鹽烤4隻巨大草蝦','馬來西亞高品質最大規格',230,'','份','hot','/seafood-stock-map/dine/grill-prawn.webp',160,1),
('dine-grill-white','grill','鹽烤大白蝦','泰國大白蝦',349,'','份','','/seafood-stock-map/dine/grill-white.webp',170,1),
('dine-grill-8p','grill','鹽烤8P大草蝦','',200,'','份','','/seafood-stock-map/dine/grill-8p.webp',180,1),
('dine-stir-snail','stir','胡椒大鳳螺（一斤整）','',250,'','份','hot','/seafood-stock-map/dine/stir-snail.webp',190,1),
('dine-stir-crableg','stir','胡椒蟹腳（半斤）','',250,'','份','hot','/seafood-stock-map/dine/stir-crab.webp',200,1),
('dine-blanch-white','blanch','川燙大白蝦','泰國大白蝦',349,'','份','hot','/seafood-stock-map/dine/blanch-white.webp',210,1),
('dine-blanch-cuttle','blanch','川燙超大小卷','',215,'','份','','/seafood-stock-map/dine/blanch-cuttle.webp',220,1),
('dine-blanch-squid','blanch','川燙大透抽','',200,'','份','','/seafood-stock-map/dine/blanch-hi.webp',230,1),
('dine-blanch-soft','blanch','川燙大軟絲','',220,'','份','','/seafood-stock-map/dine/blanch-soft.webp',240,1),
('dine-meat-rib','meat','鹽烤美國帶骨牛小排','',329,'','份','best','/seafood-stock-map/dine/meat-rib.webp',250,1),
('dine-meat-iberico','meat','鹽烤伊比利松阪豬','',238,'','份','','/seafood-stock-map/dine/meat-iberico.webp',260,1),
('dine-sashimi-nishin','sashimi','尼信切盒','',195,'','份','','/seafood-stock-map/dine/sashimi-nishin.webp',270,1),
('dine-sashimi-salmon','sashimi','挪威鮭魚現切生魚片（不定時）','不定時供應，下單後由店家確認',NULL,'時價','份','','/seafood-stock-map/dine/sashimi-salmon.webp',280,1),
('dine-live-crab','live','紅蟳','活體時價，以當日 LINE 群報價為主',NULL,'時價','份','','/seafood-stock-map/dine/live-crab.webp',290,1),
('dine-live-wugu','live','水姑娘','活體時價，以當日 LINE 群報價為主',NULL,'時價','份','','',300,1),
('dine-live-shagong','live','沙公','活體時價，以當日 LINE 群報價為主',NULL,'時價','份','','',310,1),
('dine-live-bread','live','麵包蟹','活體時價，以當日 LINE 群報價為主',NULL,'時價','份','','',320,1),
('dine-live-king','live','帝王蟹','活體時價，以當日 LINE 群報價為主',NULL,'時價','份','','',330,1),
('dine-live-lobster','live','波士頓龍蝦','活體時價，以當日 LINE 群報價為主',NULL,'時價','份','','/seafood-stock-map/dine/live-lobster.webp',340,1),
('dine-thai-salt','thai','泰國蝦（鹽烤）','料理費用；活體泰國蝦另計',50,'','份','','/seafood-stock-map/dine/thai-prawn.webp',350,1),
('dine-thai-steam','thai','泰國蝦（清蒸）','料理費用；活體泰國蝦另計',80,'','份','','/seafood-stock-map/dine/thai-prawn.webp',360,1),
('dine-thai-pepper','thai','泰國蝦（胡椒）','料理費用；活體泰國蝦另計',150,'','份','','/seafood-stock-map/dine/thai-prawn.webp',370,1);
