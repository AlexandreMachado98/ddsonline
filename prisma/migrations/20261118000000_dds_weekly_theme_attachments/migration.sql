-- DDS Semanal: imagens e PDFs de cada tema. Idempotente.
CREATE TABLE IF NOT EXISTS "DdsScheduleThemeAttachment" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileData" TEXT NOT NULL,
    "pageCount" INTEGER DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DdsScheduleThemeAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DdsScheduleThemeAttachment_themeId_order_idx" ON "DdsScheduleThemeAttachment"("themeId", "order");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DdsScheduleThemeAttachment_themeId_fkey') THEN
    ALTER TABLE "DdsScheduleThemeAttachment" ADD CONSTRAINT "DdsScheduleThemeAttachment_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "DdsScheduleTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
