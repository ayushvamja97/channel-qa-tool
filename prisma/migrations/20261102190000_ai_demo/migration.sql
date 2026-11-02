ALTER TABLE `Post` MODIFY `body` TEXT NOT NULL, ADD COLUMN `demoKey` VARCHAR(191) NULL;
ALTER TABLE `Reply` MODIFY `body` TEXT NOT NULL, ADD COLUMN `demoKey` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `Post_demoKey_key` ON `Post`(`demoKey`);
CREATE UNIQUE INDEX `Reply_demoKey_key` ON `Reply`(`demoKey`);

CREATE TABLE `PostEmbedding` (
  `postId` INTEGER NOT NULL,
  `model` VARCHAR(191) NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `vector` JSON NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`postId`),
  CONSTRAINT `PostEmbedding_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ImageAnalysis` (
  `attachmentId` INTEGER NOT NULL,
  `model` VARCHAR(191) NOT NULL,
  `vector` JSON NOT NULL,
  `category` VARCHAR(191) NULL,
  `confidence` DOUBLE NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`attachmentId`),
  CONSTRAINT `ImageAnalysis_attachmentId_fkey` FOREIGN KEY (`attachmentId`) REFERENCES `Attachment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
