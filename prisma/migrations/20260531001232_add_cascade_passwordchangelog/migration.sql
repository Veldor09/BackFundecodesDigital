-- DropForeignKey
ALTER TABLE "PasswordChangeLog" DROP CONSTRAINT "PasswordChangeLog_userId_fkey";

-- AddForeignKey
ALTER TABLE "PasswordChangeLog" ADD CONSTRAINT "PasswordChangeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
