-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: vage_clothing
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `addresses`
--

DROP TABLE IF EXISTS `addresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `addresses` (
  `address_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `recipient_name` varchar(120) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `address_line1` varchar(200) NOT NULL,
  `address_line2` varchar(200) DEFAULT NULL,
  `city` varchar(100) NOT NULL,
  `state_name` varchar(100) NOT NULL,
  `postal_code` varchar(20) NOT NULL,
  `country` varchar(80) NOT NULL DEFAULT 'India',
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`address_id`),
  KEY `idx_addresses_user` (`user_id`),
  CONSTRAINT `fk_addresses_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_addresses_phone` CHECK (regexp_like(`phone`,_utf8mb4'^[0-9]{10,15}$')),
  CONSTRAINT `chk_addresses_postal_code` CHECK (((`country` <> _utf8mb4'India') or regexp_like(`postal_code`,_utf8mb4'^[0-9]{6}$')))
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cart_items`
--

DROP TABLE IF EXISTS `cart_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cart_items` (
  `cart_item_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `cart_id` bigint unsigned NOT NULL,
  `variant_id` bigint unsigned NOT NULL,
  `quantity` int unsigned NOT NULL DEFAULT '1',
  `added_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`cart_item_id`),
  UNIQUE KEY `uq_cart_variant` (`cart_id`,`variant_id`),
  KEY `idx_cart_items_variant` (`variant_id`),
  CONSTRAINT `fk_cart_items_cart` FOREIGN KEY (`cart_id`) REFERENCES `carts` (`cart_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cart_items_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`variant_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_cart_item_quantity` CHECK ((`quantity` >= 1))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `carts`
--

DROP TABLE IF EXISTS `carts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `carts` (
  `cart_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `status` enum('ACTIVE','CHECKED_OUT','ABANDONED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`cart_id`),
  KEY `idx_carts_user_status` (`user_id`,`status`),
  CONSTRAINT `fk_carts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `category_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `slug` varchar(120) NOT NULL,
  `description` text,
  `parent_category_id` bigint unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`category_id`),
  UNIQUE KEY `uq_categories_name` (`name`),
  UNIQUE KEY `uq_categories_slug` (`slug`),
  KEY `idx_categories_parent` (`parent_category_id`),
  KEY `idx_categories_active` (`is_active`),
  CONSTRAINT `fk_categories_parent` FOREIGN KEY (`parent_category_id`) REFERENCES `categories` (`category_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `coupons`
--

DROP TABLE IF EXISTS `coupons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coupons` (
  `coupon_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `coupon_code` varchar(40) NOT NULL,
  `discount_type` enum('PERCENT','FIXED') NOT NULL,
  `discount_value` decimal(10,2) NOT NULL,
  `min_order_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `max_discount` decimal(10,2) DEFAULT NULL,
  `usage_limit` int unsigned DEFAULT NULL,
  `usage_count` int unsigned NOT NULL DEFAULT '0',
  `starts_at` datetime NOT NULL,
  `expires_at` datetime NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`coupon_id`),
  UNIQUE KEY `uq_coupons_code` (`coupon_code`),
  KEY `idx_coupons_active_dates` (`is_active`,`starts_at`,`expires_at`),
  CONSTRAINT `chk_coupon_dates` CHECK ((`expires_at` > `starts_at`)),
  CONSTRAINT `chk_coupon_discount` CHECK (((`discount_value` > 0) and (((`discount_type` = _cp850'PERCENT') and (`discount_value` <= 100)) or (`discount_type` = _cp850'FIXED')))),
  CONSTRAINT `chk_coupon_max_discount` CHECK (((`max_discount` is null) or (`max_discount` >= 0))),
  CONSTRAINT `chk_coupon_min_order` CHECK ((`min_order_amount` >= 0)),
  CONSTRAINT `chk_coupon_usage` CHECK (((`usage_limit` is null) or (`usage_count` <= `usage_limit`)))
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory`
--

DROP TABLE IF EXISTS `inventory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory` (
  `variant_id` bigint unsigned NOT NULL,
  `stock_quantity` int unsigned NOT NULL DEFAULT '0',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`variant_id`),
  CONSTRAINT `fk_inventory_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`variant_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_inventory_stock` CHECK ((`stock_quantity` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_inventory_audit_update` AFTER UPDATE ON `inventory` FOR EACH ROW BEGIN
    IF NEW.stock_quantity <> OLD.stock_quantity THEN
        INSERT INTO inventory_log (
            variant_id,
            change_type,
            quantity_change,
            stock_before,
            stock_after,
            reason
        )
        VALUES (
            NEW.variant_id,
            IF(
                NEW.stock_quantity > OLD.stock_quantity,
                'STOCK_IN',
                'STOCK_OUT'
            ),
            CAST(NEW.stock_quantity AS SIGNED)
                - CAST(OLD.stock_quantity AS SIGNED),
            OLD.stock_quantity,
            NEW.stock_quantity,
            'Automatic inventory audit'
        );
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `inventory_log`
--

DROP TABLE IF EXISTS `inventory_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_log` (
  `log_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `variant_id` bigint unsigned NOT NULL,
  `change_type` enum('STOCK_IN','STOCK_OUT','SALE','CANCELLATION','RETURN','ADJUSTMENT') NOT NULL,
  `quantity_change` int NOT NULL,
  `stock_before` int unsigned NOT NULL,
  `stock_after` int unsigned NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `changed_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `fk_inventory_log_user` (`changed_by`),
  KEY `idx_inventory_log_variant_date` (`variant_id`,`created_at`),
  KEY `idx_inventory_log_type_date` (`change_type`,`created_at`),
  CONSTRAINT `fk_inventory_log_user` FOREIGN KEY (`changed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_inventory_log_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`variant_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_inventory_log_stock` CHECK (((`stock_before` >= 0) and (`stock_after` >= 0) and (`quantity_change` = (cast(`stock_after` as signed) - cast(`stock_before` as signed)))))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `order_item_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `variant_id` bigint unsigned NOT NULL,
  `product_name` varchar(180) NOT NULL,
  `sku` varchar(64) NOT NULL,
  `size` varchar(32) NOT NULL,
  `color` varchar(64) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `quantity` int unsigned NOT NULL,
  `line_total` decimal(12,2) NOT NULL,
  PRIMARY KEY (`order_item_id`),
  KEY `idx_order_items_order` (`order_id`),
  KEY `idx_order_items_variant` (`variant_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_order_items_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`variant_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_order_item_values` CHECK (((`unit_price` >= 0) and (`quantity` >= 1) and (`line_total` = (`unit_price` * `quantity`))))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `order_status_history`
--

DROP TABLE IF EXISTS `order_status_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_status_history` (
  `history_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `old_status` enum('PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','RETURNED') DEFAULT NULL,
  `new_status` enum('PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','RETURNED') NOT NULL,
  `changed_by` bigint unsigned DEFAULT NULL,
  `note` varchar(500) DEFAULT NULL,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`history_id`),
  KEY `fk_status_history_user` (`changed_by`),
  KEY `idx_status_history_order_date` (`order_id`,`changed_at`),
  CONSTRAINT `fk_status_history_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_status_history_user` FOREIGN KEY (`changed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `order_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_number` varchar(40) NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `address_id` bigint unsigned DEFAULT NULL,
  `coupon_id` bigint unsigned DEFAULT NULL,
  `status` enum('PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','RETURNED') NOT NULL DEFAULT 'PENDING',
  `payment_status` enum('PENDING','PAID','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  `subtotal` decimal(12,2) NOT NULL,
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `shipping_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(12,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`order_id`),
  UNIQUE KEY `uq_orders_number` (`order_number`),
  KEY `fk_orders_address` (`address_id`),
  KEY `fk_orders_coupon` (`coupon_id`),
  KEY `idx_orders_user_date` (`user_id`,`created_at`),
  KEY `idx_orders_status_date` (`status`,`created_at`),
  KEY `idx_orders_payment_status` (`payment_status`),
  CONSTRAINT `fk_orders_address` FOREIGN KEY (`address_id`) REFERENCES `addresses` (`address_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`coupon_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_order_amounts` CHECK (((`subtotal` >= 0) and (`discount_amount` >= 0) and (`discount_amount` <= `subtotal`) and (`shipping_amount` >= 0) and (`total_amount` = ((`subtotal` - `discount_amount`) + `shipping_amount`))))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_order_status_history_insert` AFTER INSERT ON `orders` FOR EACH ROW BEGIN
    INSERT INTO order_status_history (
        order_id,
        old_status,
        new_status,
        changed_by,
        note
    )
    VALUES (
        NEW.order_id,
        NULL,
        NEW.status,
        NULL,
        'Initial order status'
    );
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_order_status_guard` BEFORE UPDATE ON `orders` FOR EACH ROW BEGIN
    IF NEW.status <> OLD.status THEN

        IF NOT (
            (OLD.status = 'PENDING'
                AND NEW.status IN ('CONFIRMED', 'CANCELLED'))

            OR (OLD.status = 'CONFIRMED'
                AND NEW.status IN ('PROCESSING', 'CANCELLED'))

            OR (OLD.status = 'PROCESSING'
                AND NEW.status IN ('SHIPPED', 'CANCELLED'))

            OR (OLD.status = 'SHIPPED'
                AND NEW.status = 'DELIVERED')

            OR (OLD.status = 'DELIVERED'
                AND NEW.status = 'RETURNED')
        ) THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Invalid order status transition';
        END IF;

    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_order_status_history_update` AFTER UPDATE ON `orders` FOR EACH ROW BEGIN
    IF NEW.status <> OLD.status THEN
        INSERT INTO order_status_history (
            order_id,
            old_status,
            new_status,
            changed_by,
            note
        )
        VALUES (
            NEW.order_id,
            OLD.status,
            NEW.status,
            NULL,
            'Status transition recorded automatically'
        );
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `payment_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `payment_method` enum('COD','UPI','CARD','NETBANKING','WALLET') NOT NULL,
  `status` enum('PENDING','SUCCESS','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  `amount` decimal(12,2) NOT NULL,
  `transaction_ref` varchar(120) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`payment_id`),
  UNIQUE KEY `uq_payments_transaction_ref` (`transaction_ref`),
  KEY `idx_payments_order_status` (`order_id`,`status`),
  CONSTRAINT `fk_payments_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_payment_amount` CHECK ((`amount` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `product_variants`
--

DROP TABLE IF EXISTS `product_variants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_variants` (
  `variant_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint unsigned NOT NULL,
  `sku` varchar(64) NOT NULL,
  `size` varchar(32) NOT NULL,
  `color` varchar(64) NOT NULL,
  `price_override` decimal(10,2) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`variant_id`),
  UNIQUE KEY `uq_variants_sku` (`sku`),
  UNIQUE KEY `uq_variant_options` (`product_id`,`size`,`color`),
  KEY `idx_variants_product_active` (`product_id`,`is_active`),
  CONSTRAINT `fk_variants_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_variant_price` CHECK (((`price_override` is null) or (`price_override` >= 0)))
) ENGINE=InnoDB AUTO_INCREMENT=256 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `product_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `category_id` bigint unsigned NOT NULL,
  `name` varchar(180) NOT NULL,
  `slug` varchar(200) NOT NULL,
  `brand` varchar(100) NOT NULL DEFAULT 'Vage',
  `description` text,
  `base_price` decimal(10,2) NOT NULL,
  `status` enum('DRAFT','ACTIVE','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `image_url` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `material` varchar(100) DEFAULT NULL,
  `fit_type` varchar(60) DEFAULT NULL,
  `product_origin` varchar(80) DEFAULT NULL,
  PRIMARY KEY (`product_id`),
  UNIQUE KEY `uq_products_slug` (`slug`),
  KEY `idx_products_category_status` (`category_id`,`status`),
  FULLTEXT KEY `ft_products_search` (`name`,`description`,`brand`),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_products_base_price` CHECK ((`base_price` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `returns`
--

DROP TABLE IF EXISTS `returns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `returns` (
  `return_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_item_id` bigint unsigned NOT NULL,
  `quantity` int unsigned NOT NULL,
  `reason` varchar(500) NOT NULL,
  `status` enum('REQUESTED','APPROVED','REJECTED','RECEIVED','REFUNDED') NOT NULL DEFAULT 'REQUESTED',
  `resolution_notes` text,
  `requested_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`return_id`),
  KEY `idx_returns_status_date` (`status`,`requested_at`),
  KEY `idx_returns_order_item` (`order_item_id`),
  CONSTRAINT `fk_returns_order_item` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`order_item_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_return_quantity` CHECK ((`quantity` >= 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `full_name` varchar(120) NOT NULL,
  `email` varchar(190) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('CUSTOMER','ADMIN') NOT NULL DEFAULT 'CUSTOMER',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role_active` (`role`,`is_active`),
  CONSTRAINT `chk_users_email` CHECK ((`email` like _utf8mb4'%_@_%.__%')),
  CONSTRAINT `chk_users_phone` CHECK (((`phone` is null) or regexp_like(`phone`,_utf8mb4'^[0-9]{10,15}$')))
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Temporary view structure for view `v_low_stock`
--

DROP TABLE IF EXISTS `v_low_stock`;
/*!50001 DROP VIEW IF EXISTS `v_low_stock`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_low_stock` AS SELECT 
 1 AS `variant_id`,
 1 AS `sku`,
 1 AS `product_name`,
 1 AS `category_name`,
 1 AS `size`,
 1 AS `color`,
 1 AS `stock_quantity`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_monthly_revenue`
--

DROP TABLE IF EXISTS `v_monthly_revenue`;
/*!50001 DROP VIEW IF EXISTS `v_monthly_revenue`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_monthly_revenue` AS SELECT 
 1 AS `sales_month`,
 1 AS `paid_orders`,
 1 AS `gross_subtotal`,
 1 AS `total_discounts`,
 1 AS `total_shipping`,
 1 AS `total_revenue`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_product_catalog`
--

DROP TABLE IF EXISTS `v_product_catalog`;
/*!50001 DROP VIEW IF EXISTS `v_product_catalog`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_product_catalog` AS SELECT 
 1 AS `product_id`,
 1 AS `name`,
 1 AS `slug`,
 1 AS `brand`,
 1 AS `description`,
 1 AS `base_price`,
 1 AS `status`,
 1 AS `image_url`,
 1 AS `material`,
 1 AS `fit_type`,
 1 AS `product_origin`,
 1 AS `category_id`,
 1 AS `category_name`,
 1 AS `variant_count`,
 1 AS `total_stock`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_sales_by_category`
--

DROP TABLE IF EXISTS `v_sales_by_category`;
/*!50001 DROP VIEW IF EXISTS `v_sales_by_category`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_sales_by_category` AS SELECT 
 1 AS `category_id`,
 1 AS `category_name`,
 1 AS `units_sold`,
 1 AS `gross_item_sales`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_top_customers`
--

DROP TABLE IF EXISTS `v_top_customers`;
/*!50001 DROP VIEW IF EXISTS `v_top_customers`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_top_customers` AS SELECT 
 1 AS `user_id`,
 1 AS `full_name`,
 1 AS `email`,
 1 AS `total_orders`,
 1 AS `total_spent`,
 1 AS `last_order_at`*/;
SET character_set_client = @saved_cs_client;

--
-- Dumping routines for database 'vage_clothing'
--
/*!50003 DROP FUNCTION IF EXISTS `fn_customer_lifetime_value` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` FUNCTION `fn_customer_lifetime_value`(
    p_user_id BIGINT UNSIGNED
) RETURNS decimal(12,2)
    READS SQL DATA
    DETERMINISTIC
BEGIN
    DECLARE v_lifetime_value DECIMAL(12,2) DEFAULT 0.00;

    SELECT COALESCE(SUM(total_amount), 0.00)
      INTO v_lifetime_value
      FROM orders
     WHERE user_id = p_user_id
       AND payment_status = 'PAID'
       AND status NOT IN ('CANCELLED', 'RETURNED');

    RETURN v_lifetime_value;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `confirm_payment` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `confirm_payment`(
    IN p_order_id BIGINT UNSIGNED,
    IN p_transaction_ref VARCHAR(120)
)
BEGIN
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_payment_id BIGINT UNSIGNED DEFAULT NULL;
    DECLARE v_order_status VARCHAR(20) DEFAULT NULL;
    DECLARE v_order_payment_status VARCHAR(20) DEFAULT NULL;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT COUNT(*)
      INTO v_count
      FROM orders
     WHERE order_id = p_order_id;

    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Order does not exist';
    END IF;

    SELECT status, payment_status
      INTO v_order_status, v_order_payment_status
      FROM orders
     WHERE order_id = p_order_id
     FOR UPDATE;

    IF v_order_status IN ('CANCELLED', 'RETURNED') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cannot confirm payment for a cancelled or returned order';
    END IF;

    IF v_order_payment_status = 'PAID' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Order is already marked as paid';
    END IF;

    SELECT COUNT(*)
      INTO v_count
      FROM payments
     WHERE order_id = p_order_id
       AND status IN ('PENDING', 'FAILED');

    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No pending or failed payment exists for this order';
    END IF;

    SELECT payment_id
      INTO v_payment_id
      FROM payments
     WHERE order_id = p_order_id
       AND status IN ('PENDING', 'FAILED')
     ORDER BY payment_id DESC
     LIMIT 1
     FOR UPDATE;

    UPDATE payments
       SET status = 'SUCCESS',
           transaction_ref = NULLIF(TRIM(p_transaction_ref), ''),
           paid_at = NOW()
     WHERE payment_id = v_payment_id;

    UPDATE orders
       SET payment_status = 'PAID'
     WHERE order_id = p_order_id;

    COMMIT;

    SELECT
        p_order_id AS order_id,
        'PAID' AS payment_status,
        'SUCCESS' AS payment_record_status;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `place_order` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `place_order`(
    IN p_user_id BIGINT UNSIGNED,
    IN p_address_id BIGINT UNSIGNED,
    IN p_coupon_code VARCHAR(40),
    IN p_shipping_amount DECIMAL(12,2),
    IN p_payment_method VARCHAR(20)
)
BEGIN
    DECLARE v_cart_id BIGINT UNSIGNED DEFAULT NULL;
    DECLARE v_order_id BIGINT UNSIGNED DEFAULT NULL;
    DECLARE v_coupon_id BIGINT UNSIGNED DEFAULT NULL;
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_done BOOLEAN DEFAULT FALSE;

    DECLARE v_subtotal DECIMAL(12,2) DEFAULT 0.00;
    DECLARE v_discount DECIMAL(12,2) DEFAULT 0.00;
    DECLARE v_shipping DECIMAL(12,2) DEFAULT 0.00;
    DECLARE v_total DECIMAL(12,2) DEFAULT 0.00;

    DECLARE v_coupon_type VARCHAR(10) DEFAULT NULL;
    DECLARE v_coupon_value DECIMAL(10,2) DEFAULT NULL;
    DECLARE v_coupon_minimum DECIMAL(10,2) DEFAULT NULL;
    DECLARE v_coupon_max_discount DECIMAL(10,2) DEFAULT NULL;
    DECLARE v_coupon_usage_limit INT UNSIGNED DEFAULT NULL;
    DECLARE v_coupon_usage_count INT UNSIGNED DEFAULT NULL;
    DECLARE v_coupon_starts DATETIME DEFAULT NULL;
    DECLARE v_coupon_expires DATETIME DEFAULT NULL;
    DECLARE v_coupon_active BOOLEAN DEFAULT FALSE;

    DECLARE v_variant_id BIGINT UNSIGNED;
    DECLARE v_quantity INT UNSIGNED;
    DECLARE v_product_name VARCHAR(180);
    DECLARE v_sku VARCHAR(64);
    DECLARE v_size VARCHAR(32);
    DECLARE v_color VARCHAR(64);
    DECLARE v_unit_price DECIMAL(10,2);

    DECLARE cur_cart_items CURSOR FOR
        SELECT
            ci.variant_id,
            ci.quantity,
            p.name,
            pv.sku,
            pv.size,
            pv.color,
            CAST(COALESCE(pv.price_override, p.base_price) AS DECIMAL(10,2))
        FROM cart_items AS ci
        JOIN product_variants AS pv
            ON pv.variant_id = ci.variant_id
        JOIN products AS p
            ON p.product_id = pv.product_id
        WHERE ci.cart_id = v_cart_id
        ORDER BY ci.variant_id;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- Basic input validation.
    IF p_user_id IS NULL OR p_address_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'A valid customer and delivery address are required';
    END IF;

    IF p_shipping_amount IS NULL OR p_shipping_amount < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Shipping amount must be zero or greater';
    END IF;

    IF p_payment_method IS NULL OR p_payment_method NOT IN
        ('COD', 'UPI', 'CARD', 'NETBANKING', 'WALLET') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid payment method';
    END IF;

    SELECT COUNT(*)
      INTO v_count
      FROM users
     WHERE user_id = p_user_id
       AND is_active = TRUE;

    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Customer does not exist or is inactive';
    END IF;

    SELECT COUNT(*)
      INTO v_count
      FROM addresses
     WHERE address_id = p_address_id
       AND user_id = p_user_id;

    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Delivery address does not belong to this customer';
    END IF;

    -- Lock the most recent active cart. The conditional stock UPDATEs
    -- below prevent overselling even when checkouts happen concurrently.
    SELECT COUNT(*)
      INTO v_count
      FROM carts
     WHERE user_id = p_user_id
       AND status = 'ACTIVE';

    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No active cart exists for this customer';
    END IF;

    SELECT cart_id
      INTO v_cart_id
      FROM carts
     WHERE user_id = p_user_id
       AND status = 'ACTIVE'
     ORDER BY cart_id DESC
     LIMIT 1
     FOR UPDATE;

    SELECT COUNT(*)
      INTO v_count
      FROM cart_items
     WHERE cart_id = v_cart_id;

    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'The active cart is empty';
    END IF;

    SELECT COUNT(*)
      INTO v_count
      FROM cart_items AS ci
      JOIN product_variants AS pv
        ON pv.variant_id = ci.variant_id
      JOIN products AS p
        ON p.product_id = pv.product_id
     WHERE ci.cart_id = v_cart_id
       AND (pv.is_active = FALSE OR p.status <> 'ACTIVE');

    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'The cart contains an inactive product or variant';
    END IF;

    SELECT COALESCE(
               SUM(COALESCE(pv.price_override, p.base_price) * ci.quantity),
               0.00
           )
      INTO v_subtotal
      FROM cart_items AS ci
      JOIN product_variants AS pv
        ON pv.variant_id = ci.variant_id
      JOIN products AS p
        ON p.product_id = pv.product_id
     WHERE ci.cart_id = v_cart_id;

    SET v_shipping = p_shipping_amount;
    SET v_discount = 0.00;

    -- Optional coupon. Lock the coupon record before checking its limit
    -- so two concurrent checkouts cannot both consume the final use.
    IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
        SELECT COUNT(*)
          INTO v_count
          FROM coupons
         WHERE coupon_code = UPPER(TRIM(p_coupon_code));

        IF v_count = 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Coupon code does not exist';
        END IF;

        SELECT
            coupon_id,
            discount_type,
            discount_value,
            min_order_amount,
            max_discount,
            usage_limit,
            usage_count,
            starts_at,
            expires_at,
            is_active
        INTO
            v_coupon_id,
            v_coupon_type,
            v_coupon_value,
            v_coupon_minimum,
            v_coupon_max_discount,
            v_coupon_usage_limit,
            v_coupon_usage_count,
            v_coupon_starts,
            v_coupon_expires,
            v_coupon_active
        FROM coupons
        WHERE coupon_code = UPPER(TRIM(p_coupon_code))
        LIMIT 1
        FOR UPDATE;

        IF v_coupon_active = FALSE
           OR v_coupon_starts > NOW()
           OR v_coupon_expires <= NOW() THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Coupon is inactive or outside its valid dates';
        END IF;

        IF v_coupon_usage_limit IS NOT NULL
           AND v_coupon_usage_count >= v_coupon_usage_limit THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Coupon usage limit has been reached';
        END IF;

        IF v_subtotal < v_coupon_minimum THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Cart subtotal does not meet the coupon minimum';
        END IF;

        IF v_coupon_type = 'PERCENT' THEN
            SET v_discount = ROUND(v_subtotal * v_coupon_value / 100, 2);
            IF v_coupon_max_discount IS NOT NULL
               AND v_discount > v_coupon_max_discount THEN
                SET v_discount = v_coupon_max_discount;
            END IF;
        ELSEIF v_coupon_type = 'FIXED' THEN
            SET v_discount = LEAST(v_coupon_value, v_subtotal);
        ELSE
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Unsupported coupon discount type';
        END IF;
    END IF;

    IF v_discount > v_subtotal THEN
        SET v_discount = v_subtotal;
    END IF;

    SET v_total = v_subtotal - v_discount + v_shipping;

    IF v_total <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Order total must be greater than zero';
    END IF;

    INSERT INTO orders (
        order_number,
        user_id,
        address_id,
        coupon_id,
        status,
        payment_status,
        subtotal,
        discount_amount,
        shipping_amount,
        total_amount
    )
    VALUES (
        CONCAT('VG-', UPPER(REPLACE(UUID(), '-', ''))),
        p_user_id,
        p_address_id,
        v_coupon_id,
        'PENDING',
        'PENDING',
        v_subtotal,
        v_discount,
        v_shipping,
        v_total
    );

    SET v_order_id = LAST_INSERT_ID();

    -- Decrement each stock row conditionally. If a variant has insufficient
    -- stock or has no inventory row, raise an error; the handler rolls back
    -- the order, all item rows, stock changes, audit rows, and coupon use.
    SET v_done = FALSE;
    OPEN cur_cart_items;

    cart_item_loop: LOOP
        FETCH cur_cart_items
        INTO v_variant_id, v_quantity, v_product_name,
             v_sku, v_size, v_color, v_unit_price;

        IF v_done THEN
            LEAVE cart_item_loop;
        END IF;

        UPDATE inventory
           SET stock_quantity = stock_quantity - v_quantity
         WHERE variant_id = v_variant_id
           AND stock_quantity >= v_quantity;

        IF ROW_COUNT() <> 1 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Insufficient stock or inventory record is missing';
        END IF;

        INSERT INTO order_items (
            order_id,
            variant_id,
            product_name,
            sku,
            size,
            color,
            unit_price,
            quantity,
            line_total
        )
        VALUES (
            v_order_id,
            v_variant_id,
            v_product_name,
            v_sku,
            v_size,
            v_color,
            v_unit_price,
            v_quantity,
            ROUND(v_unit_price * v_quantity, 2)
        );
    END LOOP;

    CLOSE cur_cart_items;

    INSERT INTO payments (
        order_id,
        payment_method,
        status,
        amount
    )
    VALUES (
        v_order_id,
        p_payment_method,
        'PENDING',
        v_total
    );

    IF v_coupon_id IS NOT NULL THEN
        UPDATE coupons
           SET usage_count = usage_count + 1
         WHERE coupon_id = v_coupon_id
           AND (usage_limit IS NULL OR usage_count < usage_limit);

        IF ROW_COUNT() <> 1 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Coupon usage limit was reached during checkout';
        END IF;
    END IF;

    DELETE FROM cart_items
     WHERE cart_id = v_cart_id;

    UPDATE carts
       SET status = 'CHECKED_OUT'
     WHERE cart_id = v_cart_id;

    COMMIT;

    SELECT
        v_order_id AS order_id,
        (SELECT order_number FROM orders WHERE order_id = v_order_id) AS order_number,
        v_subtotal AS subtotal,
        v_discount AS discount_amount,
        v_shipping AS shipping_amount,
        v_total AS total_amount,
        'PENDING' AS payment_status;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `set_default_address` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `set_default_address`(
    IN p_user_id BIGINT UNSIGNED,
    IN p_address_id BIGINT UNSIGNED
)
BEGIN
    DECLARE v_count INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT COUNT(*)
      INTO v_count
      FROM addresses
     WHERE address_id = p_address_id
       AND user_id = p_user_id;

    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Address does not belong to the specified customer';
    END IF;

    UPDATE addresses
       SET is_default = FALSE
     WHERE user_id = p_user_id
       AND is_default = TRUE;

    UPDATE addresses
       SET is_default = TRUE
     WHERE address_id = p_address_id
       AND user_id = p_user_id;

    COMMIT;

    SELECT address_id, user_id, is_default
      FROM addresses
     WHERE address_id = p_address_id;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Final view structure for view `v_low_stock`
--

/*!50001 DROP VIEW IF EXISTS `v_low_stock`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_low_stock` AS select `pv`.`variant_id` AS `variant_id`,`pv`.`sku` AS `sku`,`p`.`name` AS `product_name`,`c`.`name` AS `category_name`,`pv`.`size` AS `size`,`pv`.`color` AS `color`,`i`.`stock_quantity` AS `stock_quantity` from (((`inventory` `i` join `product_variants` `pv` on((`pv`.`variant_id` = `i`.`variant_id`))) join `products` `p` on((`p`.`product_id` = `pv`.`product_id`))) join `categories` `c` on((`c`.`category_id` = `p`.`category_id`))) where ((`i`.`stock_quantity` <= 5) and (`pv`.`is_active` = true) and (`p`.`status` = 'ACTIVE')) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_monthly_revenue`
--

/*!50001 DROP VIEW IF EXISTS `v_monthly_revenue`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_monthly_revenue` AS select date_format(`o`.`created_at`,'%Y-%m') AS `sales_month`,count(0) AS `paid_orders`,sum(`o`.`subtotal`) AS `gross_subtotal`,sum(`o`.`discount_amount`) AS `total_discounts`,sum(`o`.`shipping_amount`) AS `total_shipping`,sum(`o`.`total_amount`) AS `total_revenue` from `orders` `o` where ((`o`.`payment_status` = 'PAID') and (`o`.`status` not in ('CANCELLED','RETURNED'))) group by date_format(`o`.`created_at`,'%Y-%m') */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_product_catalog`
--

/*!50001 DROP VIEW IF EXISTS `v_product_catalog`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_product_catalog` AS select `p`.`product_id` AS `product_id`,`p`.`name` AS `name`,`p`.`slug` AS `slug`,`p`.`brand` AS `brand`,`p`.`description` AS `description`,`p`.`base_price` AS `base_price`,`p`.`status` AS `status`,`p`.`image_url` AS `image_url`,`p`.`material` AS `material`,`p`.`fit_type` AS `fit_type`,`p`.`product_origin` AS `product_origin`,`c`.`category_id` AS `category_id`,`c`.`name` AS `category_name`,coalesce(`v`.`variant_count`,0) AS `variant_count`,coalesce(`v`.`total_stock`,0) AS `total_stock` from ((`products` `p` join `categories` `c` on((`c`.`category_id` = `p`.`category_id`))) left join (select `pv`.`product_id` AS `product_id`,count(`pv`.`variant_id`) AS `variant_count`,coalesce(sum(`i`.`stock_quantity`),0) AS `total_stock` from (`product_variants` `pv` left join `inventory` `i` on((`i`.`variant_id` = `pv`.`variant_id`))) where (`pv`.`is_active` = true) group by `pv`.`product_id`) `v` on((`v`.`product_id` = `p`.`product_id`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_sales_by_category`
--

/*!50001 DROP VIEW IF EXISTS `v_sales_by_category`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_sales_by_category` AS select `c`.`category_id` AS `category_id`,`c`.`name` AS `category_name`,sum(`oi`.`quantity`) AS `units_sold`,sum(`oi`.`line_total`) AS `gross_item_sales` from ((((`orders` `o` join `order_items` `oi` on((`oi`.`order_id` = `o`.`order_id`))) join `product_variants` `pv` on((`pv`.`variant_id` = `oi`.`variant_id`))) join `products` `p` on((`p`.`product_id` = `pv`.`product_id`))) join `categories` `c` on((`c`.`category_id` = `p`.`category_id`))) where ((`o`.`payment_status` = 'PAID') and (`o`.`status` not in ('CANCELLED','RETURNED'))) group by `c`.`category_id`,`c`.`name` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_top_customers`
--

/*!50001 DROP VIEW IF EXISTS `v_top_customers`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_top_customers` AS select `u`.`user_id` AS `user_id`,`u`.`full_name` AS `full_name`,`u`.`email` AS `email`,count(`o`.`order_id`) AS `total_orders`,sum(`o`.`total_amount`) AS `total_spent`,max(`o`.`created_at`) AS `last_order_at` from (`users` `u` join `orders` `o` on((`o`.`user_id` = `u`.`user_id`))) where ((`o`.`payment_status` = 'PAID') and (`o`.`status` not in ('CANCELLED','RETURNED'))) group by `u`.`user_id`,`u`.`full_name`,`u`.`email` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-01 18:25:05
