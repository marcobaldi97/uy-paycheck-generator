ALTER TABLE `empresa` ADD `afiliacion_bps` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `empresa` ADD `carpeta_bse` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Keep what was entered per worker: the first non-empty value, by worker number.
UPDATE `empresa` SET
	`afiliacion_bps` = COALESCE((SELECT `afiliacion_bps` FROM `trabajadores` WHERE `afiliacion_bps` <> '' ORDER BY `numero` LIMIT 1), ''),
	`carpeta_bse` = COALESCE((SELECT `carpeta_bse` FROM `trabajadores` WHERE `carpeta_bse` <> '' ORDER BY `numero` LIMIT 1), '');--> statement-breakpoint
ALTER TABLE `trabajadores` DROP COLUMN `afiliacion_bps`;--> statement-breakpoint
ALTER TABLE `trabajadores` DROP COLUMN `carpeta_bse`;