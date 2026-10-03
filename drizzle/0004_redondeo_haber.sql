-- Redondeo always raises the líquido now, so it's a haber. The seed never overwrites existing rows.
UPDATE `conceptos` SET `tipo` = 'haber' WHERE `codigo` = 'REDONDEO';
