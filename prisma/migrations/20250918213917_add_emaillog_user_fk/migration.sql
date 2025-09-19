-- DropForeignKey
ALTER TABLE "public"."EmailLog" DROP CONSTRAINT "EmailLog_userId_fkey";

-- AddForeignKey
ALTER TABLE "public"."EmailLog" ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
