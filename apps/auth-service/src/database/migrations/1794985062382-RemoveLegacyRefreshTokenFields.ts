import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveLegacyRefreshTokenFields1794985062382 implements MigrationInterface {
    name = 'RemoveLegacyRefreshTokenFields1794985062382'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "refreshTokenHash"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "refreshTokenExpiresAt"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "refreshTokenExpiresAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD "refreshTokenHash" character varying(64)`);
    }

}
