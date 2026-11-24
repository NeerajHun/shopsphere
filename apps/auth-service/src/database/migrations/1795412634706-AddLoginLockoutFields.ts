import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLoginLockoutFields1795412634706 implements MigrationInterface {
    name = 'AddLoginLockoutFields1795412634706'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "failedLoginAttempts" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "lockedUntil" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lockedUntil"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "failedLoginAttempts"`);
    }

}
