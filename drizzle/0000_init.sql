CREATE TABLE `ajustes` (
	`clave` text PRIMARY KEY NOT NULL,
	`valor` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conceptos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`codigo` text NOT NULL,
	`descripcion` text NOT NULL,
	`tipo` text NOT NULL,
	`gravado_bps` integer NOT NULL,
	`gravado_irpf` integer NOT NULL,
	`calculo` text NOT NULL,
	`orden` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conceptos_codigo_unique` ON `conceptos` (`codigo`);--> statement-breakpoint
CREATE TABLE `empresa` (
	`id` integer PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`direccion` text NOT NULL,
	`rut` text NOT NULL,
	`nro_mtss` text NOT NULL,
	`grupo` text NOT NULL,
	`subgrupo` text NOT NULL,
	CONSTRAINT "empresa_single_row" CHECK("empresa"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `irpf_franjas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vigente_desde` text NOT NULL,
	`desde_bpc` text NOT NULL,
	`hasta_bpc` text,
	`tasa` text NOT NULL,
	FOREIGN KEY (`vigente_desde`) REFERENCES `parametros`(`vigente_desde`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `irpf_franjas_vigente_idx` ON `irpf_franjas` (`vigente_desde`);--> statement-breakpoint
CREATE TABLE `liquidaciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`periodo` text NOT NULL,
	`fecha_cargo` text NOT NULL,
	`fecha_pago` text NOT NULL,
	`estado` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `liquidaciones_periodo_unique` ON `liquidaciones` (`periodo`);--> statement-breakpoint
CREATE TABLE `parametros` (
	`vigente_desde` text PRIMARY KEY NOT NULL,
	`bpc` integer NOT NULL,
	`montepio` text NOT NULL,
	`frl` text NOT NULL,
	`tope_montepio` integer,
	`fonasa_umbral_bpc` text NOT NULL,
	`fonasa_bajo_sin_conyuge` text NOT NULL,
	`fonasa_bajo_con_conyuge` text NOT NULL,
	`fonasa_alto_sin_cargas` text NOT NULL,
	`fonasa_alto_hijos` text NOT NULL,
	`fonasa_alto_conyuge` text NOT NULL,
	`fonasa_alto_conyuge_hijos` text NOT NULL,
	`irpf_incremento_umbral_bpc` text NOT NULL,
	`irpf_incremento` text NOT NULL,
	`irpf_deduccion_umbral_bpc` text NOT NULL,
	`irpf_tasa_deduccion_baja` text NOT NULL,
	`irpf_tasa_deduccion_alta` text NOT NULL,
	`irpf_hijo_bpc_anual` text NOT NULL,
	`irpf_hijo_disc_bpc_anual` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recibo_lineas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recibo_id` integer NOT NULL,
	`concepto_id` integer,
	`descripcion` text NOT NULL,
	`cantidad` text,
	`valor_unitario` integer,
	`importe` integer NOT NULL,
	`tipo` text NOT NULL,
	`orden` integer NOT NULL,
	`origen` text NOT NULL,
	`override` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`recibo_id`) REFERENCES `recibos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`concepto_id`) REFERENCES `conceptos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recibo_lineas_recibo_idx` ON `recibo_lineas` (`recibo_id`);--> statement-breakpoint
CREATE TABLE `recibos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`liquidacion_id` integer NOT NULL,
	`trabajador_id` integer NOT NULL,
	`snapshot_empresa` text,
	`snapshot_trabajador` text,
	`overrides` text,
	`dias_no_trabajados` integer DEFAULT 0 NOT NULL,
	`lineas_manuales` text DEFAULT '[]' NOT NULL,
	`imponible_bps` integer NOT NULL,
	`imponible_irpf` integer NOT NULL,
	`total_haberes` integer NOT NULL,
	`total_descuentos` integer NOT NULL,
	`liquido` integer NOT NULL,
	FOREIGN KEY (`liquidacion_id`) REFERENCES `liquidaciones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trabajador_id`) REFERENCES `trabajadores`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recibos_liquidacion_trabajador_unique` ON `recibos` (`liquidacion_id`,`trabajador_id`);--> statement-breakpoint
CREATE TABLE `trabajador_condiciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trabajador_id` integer NOT NULL,
	`vigente_desde` text NOT NULL,
	`sueldo_nominal` integer NOT NULL,
	`fonasa_conyuge` integer NOT NULL,
	`fonasa_hijos` integer NOT NULL,
	`fonasa_tasa_manual` text,
	`irpf_hijos` integer NOT NULL,
	`irpf_hijos_discapacidad` integer NOT NULL,
	`irpf_pct_atribucion` integer NOT NULL,
	`irpf_otras_deducciones` integer NOT NULL,
	FOREIGN KEY (`trabajador_id`) REFERENCES `trabajadores`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "trabajador_condiciones_pct" CHECK("trabajador_condiciones"."irpf_pct_atribucion" in (50, 100))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trabajador_condiciones_trabajador_vigente_unique` ON `trabajador_condiciones` (`trabajador_id`,`vigente_desde`);--> statement-breakpoint
CREATE TABLE `trabajadores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`numero` integer NOT NULL,
	`ci` text NOT NULL,
	`nombre` text NOT NULL,
	`cargo` text NOT NULL,
	`fecha_ingreso` text NOT NULL,
	`afiliacion_bps` text NOT NULL,
	`carpeta_bse` text NOT NULL,
	`lugar_cobro` text NOT NULL,
	`centro_costos` text NOT NULL,
	`lugar_trabajo` text NOT NULL,
	`activo` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trabajadores_numero_unique` ON `trabajadores` (`numero`);