-- CreateEnum
CREATE TYPE "GuardianTargetType" AS ENUM ('URL', 'REPO');
CREATE TYPE "GuardianVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'AUTHORIZED');
CREATE TYPE "GuardianScanProfile" AS ENUM ('SAFE', 'FULL');
CREATE TYPE "GuardianScanType" AS ENUM ('URL_HEADERS', 'URL_EXPOSURE', 'REPO_DEPS', 'REPO_SECRETS', 'REPO_SAST', 'REPO_CONFIG');
CREATE TYPE "GuardianScanStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');
CREATE TYPE "GuardianSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "GuardianFindingStatus" AS ENUM ('OPEN', 'CONFIRMED', 'FALSE_POSITIVE', 'FIXED', 'ACCEPTED_RISK');

-- CreateTable
CREATE TABLE "guardian_targets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GuardianTargetType" NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "verification" "GuardianVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verificationToken" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "authorizedByName" TEXT,
    "authorizationNote" TEXT,
    "allowedPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rateLimitPerMin" INTEGER NOT NULL DEFAULT 60,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "guardian_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_scans" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "profile" "GuardianScanProfile" NOT NULL DEFAULT 'SAFE',
    "types" "GuardianScanType"[],
    "status" "GuardianScanStatus" NOT NULL DEFAULT 'QUEUED',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "countCritical" INTEGER NOT NULL DEFAULT 0,
    "countHigh" INTEGER NOT NULL DEFAULT 0,
    "countMedium" INTEGER NOT NULL DEFAULT 0,
    "countLow" INTEGER NOT NULL DEFAULT 0,
    "countInfo" INTEGER NOT NULL DEFAULT 0,
    "startedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "guardian_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_findings" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "type" "GuardianScanType" NOT NULL,
    "severity" "GuardianSeverity" NOT NULL,
    "status" "GuardianFindingStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "evidence" TEXT,
    "recommendation" TEXT,
    "cwe" TEXT,
    "owasp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "guardian_findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guardian_targets_projectId_idx" ON "guardian_targets"("projectId");
CREATE INDEX "guardian_scans_targetId_idx" ON "guardian_scans"("targetId");
CREATE INDEX "guardian_findings_scanId_idx" ON "guardian_findings"("scanId");

-- AddForeignKey
ALTER TABLE "guardian_targets" ADD CONSTRAINT "guardian_targets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guardian_targets" ADD CONSTRAINT "guardian_targets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "guardian_scans" ADD CONSTRAINT "guardian_scans_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "guardian_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guardian_scans" ADD CONSTRAINT "guardian_scans_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "guardian_findings" ADD CONSTRAINT "guardian_findings_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "guardian_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
