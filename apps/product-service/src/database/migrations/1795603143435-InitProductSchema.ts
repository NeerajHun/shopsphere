import { MigrationInterface, QueryRunner } from "typeorm";

export class InitProductSchema1795603143435 implements MigrationInterface {
    name = 'InitProductSchema1795603143435'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "slug" character varying(150) NOT NULL, "description" text, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_categories_slug" ON "categories"  ("slug") `);
        await queryRunner.query(`CREATE TYPE "public"."products_status_enum" AS ENUM('DRAFT', 'ACTIVE', 'ARCHIVED')`);
        await queryRunner.query(`CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(180) NOT NULL, "slug" character varying(200) NOT NULL, "sku" character varying(64) NOT NULL, "description" text, "price" numeric(12,2) NOT NULL, "currency" character(3) NOT NULL DEFAULT 'INR', "status" "public"."products_status_enum" NOT NULL DEFAULT 'DRAFT', "categoryId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_products_category_id" ON "products"  ("categoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_products_status" ON "products"  ("status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_products_sku" ON "products"  ("sku") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_products_slug" ON "products"  ("slug") `);
        await queryRunner.query(`ALTER TABLE "products" ADD CONSTRAINT "FK_ff56834e735fa78a15d0cf21926" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_ff56834e735fa78a15d0cf21926"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_products_slug"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_products_sku"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_products_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_products_category_id"`);
        await queryRunner.query(`DROP TABLE "products"`);
        await queryRunner.query(`DROP TYPE "public"."products_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_categories_slug"`);
        await queryRunner.query(`DROP TABLE "categories"`);
    }

}
