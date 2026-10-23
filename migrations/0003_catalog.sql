-- Subcategories, price types, PSČ location, 60-day validity and seller pages.
ALTER TABLE `listings` ADD COLUMN `subcategory` text DEFAULT 'ostatne' NOT NULL;
--> statement-breakpoint
ALTER TABLE `listings` ADD COLUMN `price_type` text DEFAULT 'fixed' NOT NULL;
--> statement-breakpoint
ALTER TABLE `listings` ADD COLUMN `zip` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `listings` ADD COLUMN `lat` real;
--> statement-breakpoint
ALTER TABLE `listings` ADD COLUMN `lon` real;
--> statement-breakpoint
ALTER TABLE `listings` ADD COLUMN `expires` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `listings` ADD COLUMN `expiry_notified` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `uploads` ADD COLUMN `thumb` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `listings` SET `category` = CASE `category`
  WHEN 'Elektronika' THEN 'elektro' WHEN 'Mobily' THEN 'mobily' WHEN 'Počítače' THEN 'pc'
  WHEN 'Auto-moto' THEN 'auto' WHEN 'Bývanie' THEN 'nabytok' WHEN 'Nehnuteľnosti' THEN 'reality'
  WHEN 'Šport' THEN 'sport' WHEN 'Oblečenie' THEN 'oblecenie' WHEN 'Deti' THEN 'deti'
  WHEN 'Zvieratá' THEN 'zvierata' WHEN 'Záhrada' THEN 'dom' WHEN 'Stroje' THEN 'stroje'
  WHEN 'Hudba' THEN 'hudba' WHEN 'Knihy' THEN 'knihy' WHEN 'Služby' THEN 'sluzby'
  WHEN 'Ostatné' THEN 'ostatne' ELSE `category` END;
--> statement-breakpoint
UPDATE `listings` SET `price_type` = 'free' WHERE `price` = 0;
--> statement-breakpoint
UPDATE `listings` SET `expires` = `created` + 5184000000 WHERE `expires` = 0;
--> statement-breakpoint
UPDATE `listings` SET `search` = '' , `country` = 'sk';
--> statement-breakpoint
CREATE INDEX `listing_catalog` ON `listings` (`status`,`category`,`subcategory`,`expires`);
--> statement-breakpoint
CREATE INDEX `listing_expiry` ON `listings` (`status`,`expires`,`expiry_notified`);
--> statement-breakpoint
CREATE INDEX `listing_geo` ON `listings` (`status`,`lat`,`lon`);
