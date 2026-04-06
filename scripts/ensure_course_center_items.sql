-- 若 AutoMigrate 因历史表问题未执行到课程中心，可手工执行本脚本（数据库默认 vino_db）
CREATE TABLE IF NOT EXISTS `course_center_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `subtitle` varchar(300) DEFAULT NULL,
  `slug` varchar(120) DEFAULT NULL,
  `icon` varchar(100) DEFAULT NULL,
  `coverImage` varchar(500) DEFAULT NULL,
  `videos` longtext,
  `description` text,
  `sortOrder` bigint DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_course_center_items_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
