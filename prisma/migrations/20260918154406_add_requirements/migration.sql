-- CreateEnum
CREATE TYPE "RequirementTipo" AS ENUM ('NUEVO_DESARROLLO', 'MEJORA', 'ACTUALIZACION');

-- CreateEnum
CREATE TYPE "RequirementArea" AS ENUM ('DESARROLLO', 'IMPLEMENTACION', 'INFRAESTRUCTURA', 'REDES', 'SEGURIDAD', 'INTEGRACION', 'MIGRACION', 'SOPORTE', 'MANTENIMIENTO', 'OTRO');

-- CreateEnum
CREATE TYPE "RequirementPrioridad" AS ENUM ('CRITICA', 'ALTA', 'MEDIA', 'BAJA');

-- CreateEnum
CREATE TYPE "RequirementEstado" AS ENUM ('SOLICITUD', 'ANALISIS', 'APROBADO', 'EN_DESARROLLO', 'EN_IMPLEMENTACION', 'EN_PRUEBAS', 'EN_PAUSA', 'IMPLEMENTADO', 'CERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "RequirementImpacto" AS ENUM ('SIN_IMPACTO', 'BAJO', 'MEDIO', 'ALTO', 'CRITICO');

-- CreateEnum
CREATE TYPE "RequirementAlcanceAfectados" AS ENUM ('USUARIO', 'DEPARTAMENTO', 'TIENDA', 'PAIS', 'REGION', 'ORGANIZACION');

-- CreateEnum
CREATE TYPE "RequirementRiesgo" AS ENUM ('BAJO', 'MEDIO', 'ALTO');

-- CreateEnum
CREATE TYPE "RequirementActivityTipo" AS ENUM ('COMENTARIO', 'ACTIVIDAD', 'CREACION', 'EDICION', 'CAMBIO_ESTADO', 'CAMBIO_RESPONSABLE', 'CAMBIO_PRIORIDAD', 'FECHA_MODIFICADA', 'CIERRE', 'ELIMINACION');

-- CreateTable
CREATE TABLE "requirements" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "objetivo" TEXT,
    "alcance" TEXT,
    "fueraDeAlcance" TEXT,
    "criteriosAceptacion" TEXT,
    "solicitadoPorNombre" TEXT NOT NULL,
    "departamentoSolicitante" TEXT NOT NULL,
    "gerenteDepartamento" TEXT,
    "liderProyectoId" TEXT,
    "responsableTecnicoId" TEXT,
    "observaciones" TEXT,
    "fechaSolicitud" TIMESTAMP(3) NOT NULL,
    "fechaEstimadaEntrega" TIMESTAMP(3) NOT NULL,
    "fechaRealEntrega" TIMESTAMP(3),
    "tipo" "RequirementTipo" NOT NULL,
    "area" "RequirementArea" NOT NULL,
    "prioridad" "RequirementPrioridad" NOT NULL,
    "estado" "RequirementEstado" NOT NULL DEFAULT 'SOLICITUD',
    "impacto" "RequirementImpacto" NOT NULL DEFAULT 'SIN_IMPACTO',
    "alcanceAfectados" "RequirementAlcanceAfectados",
    "alcanceAfectadosDetalle" TEXT,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "motivoBloqueo" TEXT,
    "dependenciaExterna" BOOLEAN NOT NULL DEFAULT false,
    "dependenciaInterna" BOOLEAN NOT NULL DEFAULT false,
    "responsableDependenciaId" TEXT,
    "riesgo" "RequirementRiesgo",
    "motivoRiesgo" TEXT,
    "camposArea" JSONB,
    "implementacion" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "eliminadoEn" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_activities" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "tipo" "RequirementActivityTipo" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "metadata" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_counters" (
    "projectId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "requirement_counters_pkey" PRIMARY KEY ("projectId","year")
);

-- CreateIndex
CREATE INDEX "requirements_projectId_idx" ON "requirements"("projectId");

-- CreateIndex
CREATE INDEX "requirements_projectId_estado_idx" ON "requirements"("projectId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "requirements_projectId_numero_key" ON "requirements"("projectId", "numero");

-- CreateIndex
CREATE INDEX "requirement_activities_requirementId_idx" ON "requirement_activities"("requirementId");

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_liderProyectoId_fkey" FOREIGN KEY ("liderProyectoId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_responsableTecnicoId_fkey" FOREIGN KEY ("responsableTecnicoId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_responsableDependenciaId_fkey" FOREIGN KEY ("responsableDependenciaId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_activities" ADD CONSTRAINT "requirement_activities_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_activities" ADD CONSTRAINT "requirement_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
