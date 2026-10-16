CREATE TABLE `inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`zone` text NOT NULL,
	`name` text NOT NULL,
	`spec` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit` text NOT NULL,
	`minimum` integer NOT NULL,
	`batch` text NOT NULL
);
ALTER TABLE `inventory` ADD `category` text DEFAULT '未分類' NOT NULL;
ALTER TABLE `inventory` ADD `price` text DEFAULT '' NOT NULL;
ALTER TABLE `inventory` ADD `tracked` integer DEFAULT false NOT NULL;ALTER TABLE `inventory` ADD `photo_id` text DEFAULT '' NOT NULL;
ALTER TABLE `inventory` ADD `position_note` text DEFAULT '' NOT NULL;ALTER TABLE `inventory` ADD `fridge_id` text DEFAULT '' NOT NULL;;INSERT INTO inventory (id,zone,name,spec,quantity,unit,minimum,batch,category,price,tracked,photo_id,position_note,fridge_id) VALUES
('A-肉類-1','01','美國安格斯帶骨牛小排','300g',10,'件',2,'','肉類','269',1,'photo-1','','01-left'),
('A-肉類-2','04','美國牛肋條','400g',5,'件',1,'','肉類','280',1,'photo-2','03右側','04-right'),
('D-乾貨區-1','07','阿順師胡椒粉','40g',3,'件',0,'','乾貨區','25',1,'photo-3','','');
